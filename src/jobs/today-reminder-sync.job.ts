import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';
import type { ReminderScheduleSyncService } from '../services/reminder-schedule-sync.service';

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the periodic today-reminder sync job.
 */
export function startTodayReminderSyncJob(service: ReminderScheduleSyncService): void {
  if (syncIntervalId) {
    return;
  }

  const intervalMs = config.REMINDER_SYNC_INTERVAL_MS;

  logger.info({ intervalMs }, 'starting today reminder sync job');

  void service.sync();

  syncIntervalId = setInterval(() => {
    void service.sync();
  }, intervalMs);
}

/**
 * Stops the periodic today-reminder sync job.
 */
export function stopTodayReminderSyncJob(): void {
  if (!syncIntervalId) {
    return;
  }

  clearInterval(syncIntervalId);
  syncIntervalId = null;

  logger.info('stopped today reminder sync job');
}
