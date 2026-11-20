export type DeliveryChannel = 'fcm' | 'apns';

export interface DeliveryTarget {
  channel: DeliveryChannel;
  token: string;
}

/** Keep in sync with Sahayi_Push_Notification selectDeliveryTarget. */
export function normalizeApnsDeviceToken(value: string | null | undefined): string {
  return (value ?? '').replace(/[<>\s]/g, '').trim();
}

/**
 * Picks the credential that matches the device platform.
 * iOS uses the APNs token. Android, unknown platforms, and iOS rows
 * with no APNs token use the FCM token.
 */
export function selectDeliveryTarget(
  platform: string | null | undefined,
  fcmToken: string | null | undefined,
  apnsToken: string | null | undefined,
): DeliveryTarget | null {
  const normalizedPlatform = platform?.trim().toLowerCase() ?? '';
  const fcm = fcmToken?.trim() ?? '';
  const apns = normalizeApnsDeviceToken(apnsToken);

  if (normalizedPlatform === 'ios' && apns) {
    return { channel: 'apns', token: apns };
  }

  if (!fcm) {
    return null;
  }

  return { channel: 'fcm', token: fcm };
}
