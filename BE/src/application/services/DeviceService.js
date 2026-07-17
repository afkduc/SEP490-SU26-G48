const DeviceRepository = require('../../infrastructure/repositories/DeviceRepository');
const ApiError = require('../../utils/ApiError');

class DeviceService {
  constructor() {
    this.deviceRepository = new DeviceRepository();
  }

  async listByUser(userId) {
    return this.deviceRepository.findByUserId(Number(userId));
  }

  async listAll({ userId, search, browser, os, isCurrent, dateFrom, dateTo, page, pageSize }) {
    return this.deviceRepository.findAll({ userId, search, browser, os, isCurrent, dateFrom, dateTo, page, pageSize });
  }

  async forceLogoutDevice(deviceId) {
    const devices = await this.deviceRepository.findAll({ pageSize: 1000 });
    const device = devices.items.find((d) => d.id === Number(deviceId));
    if (!device) throw new ApiError(404, 'Thiet bi khong ton tai');

    // Mark device as not current
    await this.deviceRepository.delete(deviceId);

    // End the active login session for this user+IP if exists
    return { deleted: true, deviceId: Number(deviceId) };
  }

  async forceLogoutAllOtherDevices(userId, currentDeviceId) {
    const count = await this.deviceRepository.countActiveByUserId(Number(userId));
    const deleted = await this.deviceRepository.deleteOtherDevices(Number(userId), currentDeviceId);
    return { deleted, remainingCount: count - deleted };
  }
}

module.exports = DeviceService;
