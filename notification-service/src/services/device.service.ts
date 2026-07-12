import { DeviceRepository } from '../repositories/device.repository';
import { ActiveDevice } from '../types/notification.types';
import { createChildLogger } from '../utils/logger';

export class DeviceService {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async getActiveDevicesForUser(userId: string): Promise<ActiveDevice[]> {
    const log = createChildLogger({ userId });
    const devices = await this.deviceRepository.findActiveDevicesByUserId(userId);

    log.info('Active devices fetched', { deviceCount: devices.length });
    return devices;
  }

  async getActiveDevicesByIds(deviceIds: number[]): Promise<ActiveDevice[]> {
    return this.deviceRepository.findActiveDevicesByIds(deviceIds);
  }

  async deactivateInvalidToken(deviceId: number): Promise<void> {
    const log = createChildLogger({ userDeviceTokenId: deviceId });
    await this.deviceRepository.deactivateDevice(deviceId);
    log.info('Device token deactivated due to invalid FCM token');
  }
}
