import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';
import {
  CAREGIVER_REMINDER_MISSED_TYPE,
  NOTIFICATION_MODULE,
  REMINDER_NOTIFICATION_TYPES,
  REMINDER_TITLE_PREFIX,
  REMINDER_SYNC_PAST_PHASE_SKIP_MS,
  REMINDER_SYNC_TIME_DRIFT_MS,
  type ReminderNotificationType,
} from '../constants/reminder-notification.constants';
import type { ChildReminderRepository } from '../repositories/child-reminder.repository';
import type { ScheduledNotificationRepository } from '../repositories/scheduled-notification.repository';
import type { ScheduledNotificationService } from './scheduled-notification.service';
import {
  combineReminderDateAndTime,
  getUtcDatePadRange,
  getUtcFireWindow,
} from '../utils/reminder-schedule-time.util';
import { DateTimeUtil } from '../utils/datetime.util';
import type { ScheduledNotification } from '../../generated/prisma/client';

type DesiredSchedule = {
  childReminderId: bigint;
  userId: bigint;
  title: string;
  message: string;
  notificationType: ReminderNotificationType;
  scheduledAt: Date;
};

/**
 * Reconciles reminder notification schedules for near-term pending child reminders.
 */
export class ReminderScheduleSyncService {
  readonly #childReminderRepository: ChildReminderRepository;
  readonly #scheduledNotificationRepository: ScheduledNotificationRepository;
  readonly #scheduledNotificationService: ScheduledNotificationService;

  #isRunning = false;

  constructor(
    childReminderRepository: ChildReminderRepository,
    scheduledNotificationRepository: ScheduledNotificationRepository,
    scheduledNotificationService: ScheduledNotificationService,
  ) {
    this.#childReminderRepository = childReminderRepository;
    this.#scheduledNotificationRepository = scheduledNotificationRepository;
    this.#scheduledNotificationService = scheduledNotificationService;
  }

  /**
   * Runs one sync pass for pending children whose unsent phases fall in now–1h … now+36h.
   */
  async sync(): Promise<void> {
    if (this.#isRunning) {
      logger.warn('reminder schedule sync skipped — previous run still in progress');
      return;
    }

    this.#isRunning = true;

    try {
      const { windowStart, windowEnd } = getUtcFireWindow();
      const { dayStart, dayEnd } = getUtcDatePadRange(windowStart, windowEnd);
      const pendingChildren = await this.#childReminderRepository.findActivePendingForDate(
        dayStart,
        dayEnd,
      );
      const pendingChildIds = pendingChildren.map((child) => child.id);

      const desiredSchedules = this.#buildDesiredSchedules(pendingChildren);
      const desiredByKey = new Map(
        desiredSchedules.map((schedule) => [
          this.#scheduleKey(schedule.childReminderId, schedule.notificationType),
          schedule,
        ]),
      );

      const existingSchedules =
        await this.#scheduledNotificationRepository.findActiveReminderSchedulesForDate(
          dayStart,
          dayEnd,
          pendingChildIds,
        );

      const existingByKey = new Map<string, ScheduledNotification[]>();

      for (const schedule of existingSchedules) {
        if (!schedule.ChildReminderId || !schedule.NotificationType) {
          continue;
        }

        const key = this.#scheduleKey(schedule.ChildReminderId, schedule.NotificationType);
        const bucket = existingByKey.get(key) ?? [];
        bucket.push(schedule);
        existingByKey.set(key, bucket);
      }

      let createdCount = 0;
      let cancelledCount = 0;
      let rescheduledCount = 0;

      for (const [key, desired] of desiredByKey) {
        const matches = existingByKey.get(key) ?? [];
        const sortedMatches = [...matches].sort(
          (left, right) => right.CreatedAt.getTime() - left.CreatedAt.getTime(),
        );
        const primary = sortedMatches[0];

        if (!primary) {
          await this.#scheduledNotificationService.createInternal({
            userId: desired.userId,
            title: desired.title,
            message: desired.message,
            scheduledAt: desired.scheduledAt,
            childReminderId: desired.childReminderId,
            notificationType: desired.notificationType,
          });
          createdCount += 1;
          continue;
        }

        const driftMs = Math.abs(primary.ScheduledAt.getTime() - desired.scheduledAt.getTime());
        const contentChanged =
          primary.Title !== desired.title || primary.Message !== desired.message;

        if (driftMs > REMINDER_SYNC_TIME_DRIFT_MS || contentChanged) {
          await this.#scheduledNotificationService.cancel(primary.Id.toString());
          await this.#scheduledNotificationService.createInternal({
            userId: desired.userId,
            title: desired.title,
            message: desired.message,
            scheduledAt: desired.scheduledAt,
            childReminderId: desired.childReminderId,
            notificationType: desired.notificationType,
          });
          cancelledCount += 1;
          rescheduledCount += 1;
        }

        for (const duplicate of sortedMatches.slice(1)) {
          await this.#scheduledNotificationService.cancel(duplicate.Id.toString());
          cancelledCount += 1;
        }

        existingByKey.delete(key);
      }

      for (const schedules of existingByKey.values()) {
        for (const schedule of schedules) {
          if (schedule.NotificationType === CAREGIVER_REMINDER_MISSED_TYPE) {
            continue;
          }

          await this.#scheduledNotificationService.cancel(schedule.Id.toString());
          cancelledCount += 1;
        }
      }

      logger.info(
        {
          pendingChildCount: pendingChildren.length,
          desiredScheduleCount: desiredSchedules.length,
          createdCount,
          cancelledCount,
          rescheduledCount,
          dayStart: DateTimeUtil.toISOString(dayStart),
          dayEnd: DateTimeUtil.toISOString(dayEnd),
          windowStart: DateTimeUtil.toISOString(windowStart),
          windowEnd: DateTimeUtil.toISOString(windowEnd),
          sampleFireAt: desiredSchedules[0]
            ? DateTimeUtil.toISOString(desiredSchedules[0].scheduledAt)
            : undefined,
        },
        'reminder schedule sync completed',
      );
    } catch (error) {
      logger.error({ err: error }, 'reminder schedule sync failed');
    } finally {
      this.#isRunning = false;
    }
  }

  #buildDesiredSchedules(
    pendingChildren: Awaited<
      ReturnType<ChildReminderRepository['findActivePendingForDate']>
    >,
  ): DesiredSchedule[] {
    const now = Date.now();
    const schedules: DesiredSchedule[] = [];

    for (const child of pendingChildren) {
      const fireAt = combineReminderDateAndTime(child.reminderDate, child.reminderTime);
      const body = child.note?.trim() ? child.note.trim() : child.title;
      const phases: Array<{
        notificationType: ReminderNotificationType;
        scheduledAt: Date;
        alreadySent: boolean;
        title: string;
        message: string;
      }> = [
        {
          notificationType: REMINDER_NOTIFICATION_TYPES.BEFORE,
          scheduledAt: new Date(
            fireAt.getTime() - config.REMINDER_BEFORE_OFFSET_MINUTES * 60_000,
          ),
          alreadySent: child.beforeNotificationSent,
          title: `${REMINDER_TITLE_PREFIX.UPCOMING} ${child.title}`,
          message: body,
        },
        {
          notificationType: REMINDER_NOTIFICATION_TYPES.ON_TIME,
          scheduledAt: fireAt,
          alreadySent: child.onTimeNotificationSent,
          title: child.title,
          message: body,
        },
        {
          notificationType: REMINDER_NOTIFICATION_TYPES.MISSED,
          scheduledAt: new Date(
            fireAt.getTime() + config.REMINDER_AFTER_OFFSET_MINUTES * 60_000,
          ),
          alreadySent: child.afterNotificationSent,
          title: `${REMINDER_TITLE_PREFIX.MISSED} ${child.title}`,
          message: body,
        },
      ];

      for (const phase of phases) {
        // Never recreate a phase that was already delivered for this child.
        if (phase.alreadySent) {
          continue;
        }

        const isPastPhase =
          phase.scheduledAt.getTime() < now - REMINDER_SYNC_PAST_PHASE_SKIP_MS;

        if (isPastPhase) {
          continue;
        }

        schedules.push({
          childReminderId: child.id,
          userId: child.userId,
          title: phase.title,
          message: phase.message,
          notificationType: phase.notificationType,
          scheduledAt: phase.scheduledAt,
        });
      }
    }

    return schedules;
  }

  #scheduleKey(childReminderId: bigint, notificationType: string): string {
    return `${childReminderId.toString()}:${notificationType}`;
  }
}
