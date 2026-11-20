export const NOTIFICATION_FAILURE_STAGES = {
  SCHEDULE_SYNC: 'schedule-sync',
  API_CANCEL: 'api-cancel',
  QUEUE_PUBLISH: 'queue-publish',
} as const;

const ERROR_MESSAGE_MAX_LENGTH = 1000;

export function formatNotificationFailure(stage: string, reason: string): string {
  const trimmedStage = stage.trim() || 'unknown';
  const trimmedReason = reason.trim() || 'No reason was provided';
  return `[${trimmedStage}] ${trimmedReason}`.slice(0, ERROR_MESSAGE_MAX_LENGTH);
}

export function buildScheduleSyncCancelReason(input: {
  kind: 'reschedule' | 'duplicate' | 'undesired';
  driftMs?: number;
  contentChanged?: boolean;
}): string {
  if (input.kind === 'duplicate') {
    return 'duplicate schedule for the same child reminder and notification type';
  }

  if (input.kind === 'undesired') {
    return 'child reminder is no longer in the desired schedule set';
  }

  const parts: string[] = [];
  if ((input.driftMs ?? 0) > 0) {
    parts.push(`fire time drifted by ${input.driftMs} ms`);
  }
  if (input.contentChanged) {
    parts.push('title or message changed');
  }

  return parts.join('; ') || 'schedule no longer matches the reminder';
}
