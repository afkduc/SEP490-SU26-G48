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
    // Bien so: nguoi go co the bo qua dau "-" (vd go "30a12345" thay vi
    // "30a-12345") - rieng cot nay so khop THEM ca ban da bo dau "-", khong
    // thi go thieu gach ngang la khong tim ra xe da co, de tuong nham la
    // xe chua ton tai.
    const plateNeedle = needle.replace(/-/g, '');

    const rows = await this.vehicleSearchRepository.findAllCustomerVehicleRows();
    const matched = rows.filter(
      (r) =>
        normalizeVietnamese(r.full_name).includes(needle) ||
        normalizeVietnamese(r.phone).includes(needle) ||
        normalizeVietnamese(r.license_plate).includes(needle) ||
        normalizeVietnamese(r.license_plate).replace(/-/g, '').includes(plateNeedle) ||
        normalizeVietnamese(r.frame_number).includes(needle) ||
        normalizeVietnamese(r.engine_number).includes(needle)
    );
    return matched.slice(0, 10).map(toVehicleSearchDto);
  }
}

module.exports = VehicleSearchService;
