const ApiError = require('../../utils/ApiError');

class VehicleOwnershipService {
  constructor({ vehicleOwnershipRepository }) {
    this.vehicleOwnershipRepository = vehicleOwnershipRepository;
  }

  async getHistory(vehicleId) {
    if (!vehicleId) throw new ApiError(400, 'vehicleId is required');
    return this.vehicleOwnershipRepository.findHistoryByVehicleId(vehicleId);
  }

  async transfer(vehicleId, { newCustomerId, newCustomer, transferDate, notes } = {}) {
    if (!vehicleId) throw new ApiError(400, 'vehicleId is required');
    if (!newCustomerId && !newCustomer) {
      throw new ApiError(400, 'Vui lòng chọn khách hàng nhận chuyển nhượng hoặc nhập thông tin khách hàng mới');
    }
    if (newCustomer && (!newCustomer.fullName?.trim() || !newCustomer.phone?.trim())) {
      throw new ApiError(400, 'Khách hàng mới phải có họ tên và số điện thoại');
    }

    const history = await this.vehicleOwnershipRepository.findHistoryByVehicleId(vehicleId);
    if (history.length === 0) throw new ApiError(404, 'Không tìm thấy xe');

    const current = history.find((h) => !h.endDate);
    if (current && newCustomerId && String(current.customerId) === String(newCustomerId)) {
      throw new ApiError(400, 'Khách hàng này đã là chủ sở hữu hiện tại của xe');
    }

    return this.vehicleOwnershipRepository.transferOwnership(vehicleId, {
      newCustomerId,
      newCustomer,
      transferDate: transferDate || new Date(),
      notes,
    });
  }
}

module.exports = VehicleOwnershipService;
