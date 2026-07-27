const ApiError = require('../../utils/ApiError');
const { toVehicleSearchDto } = require('../dto/VehicleSearchDto');
const { normalizeVietnamese } = require('../../utils/vietnamese');

class VehicleSearchService {
  constructor(vehicleSearchRepository) {
    this.vehicleSearchRepository = vehicleSearchRepository;
  }

  async search(term) {
    if (!term || term.trim().length < 2) {
      throw new ApiError(400, 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự');
    }
    const needle = normalizeVietnamese(term.trim());

    const rows = await this.vehicleSearchRepository.findAllCustomerVehicleRows();
    const matched = rows.filter(
      (r) =>
        normalizeVietnamese(r.full_name).includes(needle) ||
        normalizeVietnamese(r.phone).includes(needle) ||
        normalizeVietnamese(r.license_plate).includes(needle) ||
        normalizeVietnamese(r.frame_number).includes(needle) ||
        normalizeVietnamese(r.engine_number).includes(needle)
    );
    return matched.slice(0, 10).map(toVehicleSearchDto);
  }
}

module.exports = VehicleSearchService;
