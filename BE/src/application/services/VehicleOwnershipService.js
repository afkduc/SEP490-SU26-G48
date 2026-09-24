const ApiError = require('../../utils/ApiError');
const { getCustomerFieldErrors } = require('./customerValidation');

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
    // Rang buoc dung chung voi form sua khach hang / import Excel - khach hang
    // moi tao tu day cung phai sach du lieu nhu moi duong vao khac (xem
    // customerValidation.js).
    if (newCustomer) {
      const errors = getCustomerFieldErrors(newCustomer);
      if (errors.length) throw new ApiError(400, errors.join('. '));
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
