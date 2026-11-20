import { REMINDER_NOTIFICATION_TYPES } from '../../constants/reminder-notification.constants';
import { ReminderScheduleSyncService } from '../reminder-schedule-sync.service';

describe('ReminderScheduleSyncService', () => {
  it('cancels a drifted schedule with a schedule-sync reason and creates a replacement', async () => {
    const fireAt = new Date(Date.now() + 10 * 60_000);
    const cancel = jest.fn().mockResolvedValue({});
    const createInternal = jest.fn().mockResolvedValue({});
    const childRepository = {
      findActivePendingForDate: jest.fn().mockResolvedValue([
        {
          id: 5n,
          masterReminderId: 1n,
          userId: 9n,
          title: 'Medicine',
          note: null,
          reminderDate: fireAt,
          reminderTime: fireAt,
          statusName: 'PENDING',
          masterIsActive: true,
          beforeNotificationSent: true,
          onTimeNotificationSent: false,
          afterNotificationSent: true,
        },
      ]),
    };
    const scheduleRepository = {
      findActiveReminderSchedulesForDate: jest.fn().mockResolvedValue([
        {
          Id: 44n,
          ChildReminderId: 5n,
          NotificationType: REMINDER_NOTIFICATION_TYPES.ON_TIME,
          Title: 'Medicine',
          Message: 'Medicine',
          ScheduledAt: new Date(0),
          CreatedAt: new Date(),
        },
      ]),
    };

    const service = new ReminderScheduleSyncService(
      childRepository as never,
      scheduleRepository as never,
      { cancel, createInternal } as never,
    );

    await service.sync();

    expect(cancel).toHaveBeenCalledWith(
      '44',
      expect.stringContaining('fire time drifted by'),
      'schedule-sync',
    );
    expect(createInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        childReminderId: 5n,
        notificationType: REMINDER_NOTIFICATION_TYPES.ON_TIME,
        userId: 9n,
      }),
    );
  });
});
