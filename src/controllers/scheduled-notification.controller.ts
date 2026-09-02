import type { NextFunction, Request, Response } from 'express';
import { response } from '../../libs/response/src/response';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import type { ReminderScheduleSyncService } from '../services/reminder-schedule-sync.service';
import type { ScheduledNotificationService } from '../services/scheduled-notification.service';
import type {
  BulkMarkDeliveredReadBody,
  CreateScheduledNotificationBody,
} from '../validators/scheduled-notification.validator';

type CancelScheduledNotificationParams = {
  id: string;
};

type CancelByChildReminderParams = {
  childReminderId: string;
};

type CancelByUserParams = {
  userId: string;
};

/**
 * HTTP handlers for scheduled notifications.
 */
export class ScheduledNotificationController {
  readonly #service: ScheduledNotificationService;
  readonly #reminderSyncService: ReminderScheduleSyncService;

  constructor(
    service: ScheduledNotificationService,
    reminderSyncService: ReminderScheduleSyncService,
  ) {
    this.#service = service;
    this.#reminderSyncService = reminderSyncService;
    this.create = this.create.bind(this);
    this.getDelivered = this.getDelivered.bind(this);
    this.bulkMarkDeliveredAsRead = this.bulkMarkDeliveredAsRead.bind(this);
    this.getUnreadDeliveredCount = this.getUnreadDeliveredCount.bind(this);
    this.cancel = this.cancel.bind(this);
    this.cancelByChildReminder = this.cancelByChildReminder.bind(this);
    this.cancelByUser = this.cancelByUser.bind(this);
    this.syncTodayReminders = this.syncTodayReminders.bind(this);
  }

  /**
   * POST /notifications/schedule-notification
   * Creates a scheduled notification and enqueues it on Azure Service Bus.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateScheduledNotificationBody;
      const data = await this.#service.create(body);

      res.status(201).json({
        ...response.DATA_SAVED,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /notifications/sync-today-reminders
   * Runs one reconcile pass for today's pending child reminders.
   */
  async syncTodayReminders(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await this.#reminderSyncService.sync();

      res.status(200).json({
        ...response.createJson(response.SUCCESS_CODE, { synced: true }, 1),
        message: 'Today reminder sync completed',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /notifications/delivered-notification
   * Returns paginated delivered notifications for the authenticated user.
   */
  async getDelivered(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json(response.UNAUTHORIZED);
        return;
      }

      const query = req.query as unknown as {
        page: number;
        limit: number;
      };

      const result = await this.#service.getDelivered(req.user.id, query);

      if (result.total === 0 || result.items.length === 0) {
        res.status(200).json(response.NO_DATA_FOUND);
        return;
      }

      res.status(200).json({
        ...response.createJson(response.SUCCESS_CODE, result.items, result.total),
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /notifications/delivered-notification/mark-read
   * Bulk marks delivered notifications as read for the authenticated user.
   */
  async bulkMarkDeliveredAsRead(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json(response.UNAUTHORIZED);
        return;
      }

      const body = req.body as BulkMarkDeliveredReadBody;
      const data = await this.#service.bulkMarkDeliveredAsRead(req.user.id, body);

      res.status(200).json({
        ...response.DATA_UPDATED,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /notifications/delivered-notification/unread-count
   * Returns unread delivered notification count for the authenticated user.
   */
  async getUnreadDeliveredCount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json(response.UNAUTHORIZED);
        return;
      }

      const data = await this.#service.getUnreadDeliveredCount(req.user.id);

      res.status(200).json(response.createJson(response.SUCCESS_CODE, data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /notifications/schedule-notification/:id
   * Cancels a scheduled notification.
   */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as CancelScheduledNotificationParams;
      const data = await this.#service.cancel(id);

      res.status(200).json({
        ...response.DATA_DELETED_SUCCESSFULLY,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /notifications/schedule-notification/by-child-reminder/:childReminderId
   * Cancels all active schedules for a child reminder.
   */
  async cancelByChildReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { childReminderId } = req.params as CancelByChildReminderParams;
      const data = await this.#service.cancelByChildReminder(childReminderId);

      res.status(200).json({
        ...response.DATA_DELETED_SUCCESSFULLY,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /notifications/by-user/:userId
   * Cancels all active schedules for a user.
   */
  async cancelByUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params as CancelByUserParams;
      const data = await this.#service.cancelByUser(userId);

      res.status(200).json({
        ...response.DATA_DELETED_SUCCESSFULLY,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
