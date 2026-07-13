const ApiError = require('../../utils/ApiError');
const { normalizeVietnamese } = require('../../utils/vietnamese');

class CustomerService {
  constructor({ customerRepository }) {
    this.customerRepository = customerRepository;
  }

  // Tra cuu danh sach khach hang - fetch het roi loc khong-dau + phan trang
  // o day (giong VehicleSearchService/InventoryService.searchProducts).
  async getAll({ search, page = 1, limit = 20 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const all = await this.customerRepository.findAllWithDetails();

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

  async getById(id) {
    const customer = await this.customerRepository.findByIdWithDetails(id);
    if (!customer) throw new ApiError(404, 'Không tìm thấy khách hàng');
    return customer;
  }

  async update(id, data) {
    if (!data.fullName || !data.fullName.trim()) {
      throw new ApiError(400, 'Họ và tên không được để trống');
    }
    if (!data.phone || !data.phone.trim()) {
      throw new ApiError(400, 'Số điện thoại không được để trống');
    }
    const existing = await this.customerRepository.findByIdWithDetails(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy khách hàng');

    return this.customerRepository.update(id, data);
  }
}

module.exports = CustomerService;
