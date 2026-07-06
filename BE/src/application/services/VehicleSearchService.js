const ApiError = require('../../utils/ApiError');
const { toVehicleSearchDto } = require('../dto/VehicleSearchDto');

class VehicleSearchService {
  constructor(vehicleSearchRepository) {
    this.vehicleSearchRepository = vehicleSearchRepository;
  }

  async search(term) {
    if (!term || term.trim().length < 2) {
      throw new ApiError(400, 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự');
    }
    const rows = await this.vehicleSearchRepository.searchByCustomerOrVehicle(term.trim());
    return rows.map(toVehicleSearchDto);
  }
}

module.exports = VehicleSearchService;
