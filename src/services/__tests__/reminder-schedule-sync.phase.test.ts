/**
 * Pure helper mirroring ReminderScheduleSyncService phase-desire rules
 * after the alreadySent / past-phase fix.
 */
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
