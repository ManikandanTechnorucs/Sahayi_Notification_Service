import { prisma } from '../../libs/db/src/prisma';

export type ActivePendingChildReminder = {
  id: bigint;
  masterReminderId: bigint;
  userId: bigint;
  title: string;
  note: string | null;
  reminderDate: Date;
  reminderTime: Date;
  statusName: string;
  masterIsActive: boolean;
  beforeNotificationSent: boolean;
  onTimeNotificationSent: boolean;
  afterNotificationSent: boolean;
};

/**
 * Data-access for child reminder rows used by notification sync.
 */
export class ChildReminderRepository {
  /**
   * Loads active PENDING child reminders for the given local calendar day range.
   */
  async findActivePendingForDate(
    dayStart: Date,
    dayEnd: Date,
  ): Promise<ActivePendingChildReminder[]> {
    const rows = await prisma.childreminder.findMany({
      where: {
        IsActive: true,
        ReminderDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        statusmaster: {
          StatusName: 'PENDING',
        },
        masterreminder: {
          IsActive: true,
        },
      },
      include: {
        masterreminder: {
          select: {
            UserId: true,
            Title: true,
            Note: true,
            IsActive: true,
          },
        },
        statusmaster: {
          select: {
            StatusName: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.Id,
      masterReminderId: row.MasterReminderId,
      userId: row.masterreminder.UserId,
      title: row.masterreminder.Title,
      note: row.masterreminder.Note,
      reminderDate: row.ReminderDate,
      reminderTime: row.ReminderTime,
      statusName: row.statusmaster.StatusName,
      masterIsActive: row.masterreminder.IsActive,
      beforeNotificationSent: row.BeforeNotificationSent,
      onTimeNotificationSent: row.OnTimeNotificationSent,
      afterNotificationSent: row.AfterNotificationSent,
    }));
  }
}
