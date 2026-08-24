/**
 * Pure helper mirroring ReminderScheduleSyncService phase-desire rules
 * after the alreadySent / past-phase fix.
 */
import { combineReminderDateAndTime } from '../../utils/reminder-schedule-time.util';

function shouldDesirePhase(input: {
  alreadySent: boolean;
  scheduledAtMs: number;
  nowMs: number;
  pastSkipMs: number;
}): boolean {
  if (input.alreadySent) {
    return false;
  }

  const isPastPhase = input.scheduledAtMs < input.nowMs - input.pastSkipMs;
  return !isPastPhase;
}

describe('reminder schedule sync phase desire', () => {
  const pastSkipMs = 60_000;

  it('does not desire a phase that was already sent even within the 60s window', () => {
    const nowMs = Date.parse('2026-08-10T12:00:30.000Z');
    const scheduledAtMs = Date.parse('2026-08-10T12:00:00.000Z');

    expect(
      shouldDesirePhase({
        alreadySent: true,
        scheduledAtMs,
        nowMs,
        pastSkipMs,
      }),
    ).toBe(false);
  });

  it('desires an unsent future phase', () => {
    const nowMs = Date.parse('2026-08-10T11:00:00.000Z');
    const scheduledAtMs = Date.parse('2026-08-10T12:00:00.000Z');

    expect(
      shouldDesirePhase({
        alreadySent: false,
        scheduledAtMs,
        nowMs,
        pastSkipMs,
      }),
    ).toBe(true);
  });

  it('skips an unsent phase that is past the grace window', () => {
    const nowMs = Date.parse('2026-08-10T12:05:00.000Z');
    const scheduledAtMs = Date.parse('2026-08-10T12:00:00.000Z');

    expect(
      shouldDesirePhase({
        alreadySent: false,
        scheduledAtMs,
        nowMs,
        pastSkipMs,
      }),
    ).toBe(false);
  });
});

describe('reminder schedule offsets T-5 / T / T+30', () => {
  const beforeOffsetMs = 5 * 60_000;
  const afterOffsetMs = 30 * 60_000;

  it('schedules before at T-5, due at T, and missed at T+30 from the UTC fire instant', () => {
    const fireAt = combineReminderDateAndTime(
      new Date(Date.UTC(2026, 7, 20)),
      new Date(Date.UTC(1970, 0, 1, 2, 30, 0)),
    );

    expect(fireAt.toISOString()).toBe('2026-08-20T02:30:00.000Z');
    expect(new Date(fireAt.getTime() - beforeOffsetMs).toISOString()).toBe(
      '2026-08-20T02:25:00.000Z',
    );
    expect(new Date(fireAt.getTime() + afterOffsetMs).toISOString()).toBe(
      '2026-08-20T03:00:00.000Z',
    );
  });
});

describe('missed + caregiver delivery policy', () => {
  const TERMINAL = new Set(['COMPLETED', 'SKIPPED', 'CANCELLED']);

  function shouldSendUserMissed(statusName: string): boolean {
    return statusName === 'PENDING';
  }

  function shouldFanOutCaregivers(statusName: string): boolean {
    return statusName === 'PENDING' || statusName === 'MISSED';
  }

  it('does not send missed or caregiver alerts for completed or skipped children', () => {
    for (const status of TERMINAL) {
      expect(shouldSendUserMissed(status)).toBe(false);
      expect(shouldFanOutCaregivers(status)).toBe(false);
    }
  });

  it('sends user missed + caregiver when still pending', () => {
    expect(shouldSendUserMissed('PENDING')).toBe(true);
    expect(shouldFanOutCaregivers('PENDING')).toBe(true);
  });

  it('skips user missed but still fans out caregivers when already MISSED', () => {
    expect(shouldSendUserMissed('MISSED')).toBe(false);
    expect(shouldFanOutCaregivers('MISSED')).toBe(true);
  });
});
