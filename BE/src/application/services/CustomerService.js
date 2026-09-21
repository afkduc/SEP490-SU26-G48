const ApiError = require('../../utils/ApiError');
const { normalizeVietnamese } = require('../../utils/vietnamese');
const { parseCustomerImportFile } = require('./customerImportParser');
const { getCustomerFieldErrors, getVehicleFieldErrors, normalizePlate } = require('./customerValidation');
const { phoneDigitsOnly } = require('../../utils/fieldValidation');

class CustomerService {
  constructor({ customerRepository }) {
    this.customerRepository = customerRepository;
  }

  // Tra cuu danh sach khach hang - fetch het roi loc khong-dau + phan trang
  // o day (giong VehicleSearchService/InventoryService.searchProducts).
  async getAll({ search, page = 1, limit = 20, branchId } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const all = await this.customerRepository.findAllWithDetails(branchId);

    let filtered = all;
    if (search && search.trim().length > 0) {
      const needle = normalizeVietnamese(search.trim());
      filtered = all.filter(
        (c) =>
          normalizeVietnamese(c.fullName).includes(needle) ||
          normalizeVietnamese(c.phone).includes(needle) ||
          c.vehicles.some((v) => normalizeVietnamese(v.licensePlate).includes(needle))
      );
    }

    const total = filtered.length;
    const offset = (safePage - 1) * safeLimit;
    const items = filtered.slice(offset, offset + safeLimit);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      summary: {
        totalCustomers: all.length,
        totalServiceHistory: all.reduce((sum, c) => sum + Number(c.historyCount || 0), 0),
      },
    };
  }

  async getById(id, branchId) {
    const customer = await this.customerRepository.findByIdWithDetails(id, branchId);
    if (!customer) throw new ApiError(404, 'Không tìm thấy khách hàng');
    return customer;
  }

  async update(id, data, branchId) {
    const errors = getCustomerFieldErrors(data);
    if (errors.length) throw new ApiError(400, errors.join('. '));

    const existing = await this.customerRepository.findByIdWithDetails(id, branchId);
    if (!existing) throw new ApiError(404, 'Không tìm thấy khách hàng');

    // SDT la khoa nhan dien khach (import Excel + tao phieu quyet toan deu
    // tim khach theo SDT) nen KHONG duoc doi sang SDT cua khach khac.
    const phone = phoneDigitsOnly(data.phone);
    const other = await this.customerRepository.findByPhone(phone);
    if (other && String(other.id) !== String(id)) {
      throw new ApiError(409, `Số điện thoại ${phone} đã thuộc khách hàng "${other.fullName}" (${other.customerCode || other.id})`);
    }

    // Chi chuan hoa truong nao CO gui len - khong tu them key null vao payload
    // (repository da tu quy ve NULL khi trong).
    const normalized = {
      ...data,
      fullName: String(data.fullName).trim().replace(/\s+/g, ' '),
      phone,
    };
    for (const key of ['cccd', 'email', 'address']) {
      if (key in data) normalized[key] = data[key] ? String(data[key]).trim() : null;
    }
    if ('dateOfBirth' in data) normalized.dateOfBirth = data.dateOfBirth || null;

    return this.customerRepository.update(id, normalized);
  }

  // Them 1 xe cho khach da co - thay cho viec phai chen thang vao DB.
  async addVehicle(customerId, data, branchId) {
    const errors = getVehicleFieldErrors(data);
    if (errors.length) throw new ApiError(400, errors.join('. '));

    const existing = await this.customerRepository.findByIdWithDetails(customerId, branchId);
    if (!existing) throw new ApiError(404, 'Không tìm thấy khách hàng');

    const toOptionalUpper = (v) => (v ? String(v).trim().toUpperCase() : null);
    return this.customerRepository.addVehicle(Number(customerId), {
      licensePlate: normalizePlate(data.licensePlate),
      modelId: Number(data.modelId),
      frameNumber: toOptionalUpper(data.frameNumber),
      engineNumber: toOptionalUpper(data.engineNumber),
      manufactureYear: data.manufactureYear === '' || data.manufactureYear == null ? null : Number(data.manufactureYear),
      color: data.color ? String(data.color).trim() : null,
      currentKm: data.currentKm === '' || data.currentKm == null ? 0 : Number(data.currentKm),
    });
  }

  // Import khach hang + xe tu file Excel: moi dong = 1 khach hang + 1 xe.
  // SDT trung -> dung lai khach hang cu (khong tao trung); bien so/so khung/so may
  // trung -> bo qua phan tao xe cua dong do (khach hang van duoc tao/dung neu hop le).
  async importFromExcel(buffer) {
    const rows = await parseCustomerImportFile(buffer);

    const result = {
      totalRows: rows.length,
      customersCreated: 0,
      customersReused: 0,
      vehiclesCreated: 0,
      vehiclesSkipped: 0,
      errors: [],
    };

    for (const row of rows) {
      if (row.errors.length > 0) {
        result.errors.push({ row: row.rowNumber, reason: row.errors.join('; ') });
        continue;
      }

      try {
        const outcome = await this.customerRepository.importCustomerVehicleRow(row.payload);
        if (outcome.customerCreated) result.customersCreated += 1;
        else result.customersReused += 1;

        if (outcome.vehicleCreated) {
          result.vehiclesCreated += 1;
        } else if (outcome.vehicleSkipped) {
          result.vehiclesSkipped += 1;
          result.errors.push({
            row: row.rowNumber,
            reason: `Bỏ qua xe: ${outcome.vehicleSkipReason || 'thông tin xe đã tồn tại trong hệ thống'}`,
          });
        }
      } catch (err) {
        result.errors.push({ row: row.rowNumber, reason: err.message || 'Lỗi không xác định khi lưu dữ liệu' });
      }
    }

    return result;
  }
}

module.exports = CustomerService;
