import { getMessaging } from '../firebase/firebase.config';
import { ActiveDevice, DeviceSendResult } from '../types/notification.types';
import { isPermanentFcmError, stringifyDataPayload } from '../utils/fcm.utils';
import { createChildLogger } from '../utils/logger';

export interface FcmNotificationInput {
  title: string;
  body: string;
  data?: Record<string, string | undefined>;
}

export class FcmService {
  async sendToDevice(
    device: ActiveDevice,
    notification: FcmNotificationInput
  ): Promise<DeviceSendResult> {
    const log = createChildLogger({
      userDeviceTokenId: device.id,
      userId: device.userId,
    });

    try {
      const messaging = getMessaging();

      await messaging.send({
        token: device.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: stringifyDataPayload(notification.data),
        android: {
          priority: 'high',
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      });

      log.info('FCM notification sent successfully');

      return {
        userDeviceTokenId: device.id,
        fcmToken: device.fcmToken,
        success: true,
        isPermanentFailure: false,
      };
    } catch (error: unknown) {
      const errorCode = this.extractErrorCode(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const permanent = isPermanentFcmError(errorCode);

      log.warn('FCM notification failed', {
        errorCode,
        errorMessage,
        isPermanentFailure: permanent,
      });

      return {
        userDeviceTokenId: device.id,
        fcmToken: device.fcmToken,
        success: false,
        errorCode,
        errorMessage,
        isPermanentFailure: permanent,
      };
    }
  }

  async sendToDevices(
    devices: ActiveDevice[],
    notification: FcmNotificationInput
  ): Promise<DeviceSendResult[]> {
    const results: DeviceSendResult[] = [];

    for (const device of devices) {
      const result = await this.sendToDevice(device, notification);
      results.push(result);
    }

    return results;
  }

  private extractErrorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'code' in error) {
      return String((error as { code: string }).code);
    }
    return undefined;
  }
}
