import { PrismaClient } from '@prisma/client';
import { ActiveDevice } from '../types/notification.types';

function toActiveDevice(device: {
  Id: bigint;
  UserId: bigint;
  FcmToken: string;
  DeviceId: string | null;
  Platform: string;
}): ActiveDevice {
  return {
    id: Number(device.Id),
    userId: String(device.UserId),
    fcmToken: device.FcmToken,
    deviceId: device.DeviceId,
    platform: device.Platform,
  };
}

export class DeviceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveDevicesByUserId(userId: string): Promise<ActiveDevice[]> {
    const devices = await this.prisma.userdevicetoken.findMany({
      where: {
        UserId: BigInt(userId),
        IsActive: true,
      },
      select: {
        Id: true,
        UserId: true,
        FcmToken: true,
        DeviceId: true,
        Platform: true,
      },
    });

    return devices.map(toActiveDevice);
  }

  async findActiveDevicesByIds(deviceIds: number[]): Promise<ActiveDevice[]> {
    if (deviceIds.length === 0) {
      return [];
    }

    const devices = await this.prisma.userdevicetoken.findMany({
      where: {
        Id: { in: deviceIds.map((id) => BigInt(id)) },
        IsActive: true,
      },
      select: {
        Id: true,
        UserId: true,
        FcmToken: true,
        DeviceId: true,
        Platform: true,
      },
    });

    return devices.map(toActiveDevice);
  }

  async deactivateDevice(deviceId: number): Promise<void> {
    await this.prisma.userdevicetoken.update({
      where: { Id: BigInt(deviceId) },
      data: {
        IsActive: false,
        DeactivatedAt: new Date(),
        DeactivationReason: 'invalid_fcm_token',
      },
    });
  }
}
