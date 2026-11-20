import { buildScheduleSyncCancelReason } from '../notification-failure';

describe('buildScheduleSyncCancelReason', () => {
  it('describes drift, content changes, duplicates, and dropped schedules', () => {
    expect(buildScheduleSyncCancelReason({ kind: 'reschedule', driftMs: 120000 })).toBe(
      'fire time drifted by 120000 ms',
    );
    expect(
      buildScheduleSyncCancelReason({
        kind: 'reschedule',
        driftMs: 120000,
        contentChanged: true,
      }),
    ).toBe('fire time drifted by 120000 ms; title or message changed');
    expect(buildScheduleSyncCancelReason({ kind: 'duplicate' })).toMatch(/duplicate schedule/);
    expect(buildScheduleSyncCancelReason({ kind: 'undesired' })).toMatch(
      /no longer in the desired schedule set/,
    );
  });
});
