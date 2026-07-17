const ApiError = require('../../utils/ApiError');
const ExportRequestResponseDto = require('../dto/ExportRequestResponseDto');
const { validateCreateExportRequest } = require('../dto/ExportRequestCreateDto');
const { runInTransaction } = require('../../utils/sqlTransaction');

/**
 * Service cho Export Request (Phieu xuat kho).
 * Khac voi ImportRequest:
 *   - KHONG can Manager duyet - NVKho xuat truc tiep theo Service Order.
 *   - create() thuc hien ngay: insert phieu + tru stock + ghi log.
 *   - Neu stock khong du -> throw ApiError(409), rollback toan bo.
 */
class ExportRequestService {
  constructor({ exportRequestRepository }) {
    this.exportRequestRepository = exportRequestRepository;
  }

  async list({ branchId, status, repairOrderId, serviceOrderId, fromDate, toDate, search, page, limit } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const filters = {
      branchId: Number(branchId),
      status: status || undefined,
      repairOrderId: repairOrderId ? Number(repairOrderId) : undefined,
      serviceOrderId: serviceOrderId ? Number(serviceOrderId) : undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      search: search || undefined,
    };
    const [items, total] = await Promise.all([
      this.exportRequestRepository.findAll({ ...filters, page: safePage, limit: safeLimit }),
      this.exportRequestRepository.count(filters),
    ]);
    return {
      items: ExportRequestResponseDto.fromEntityList(items),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getById(id) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    const result = await this.exportRequestRepository.findById(numId);
    if (!result) throw new ApiError(404, 'Khong tim thay phieu xuat');
    return ExportRequestResponseDto.fromEntity(result.request, result.items);
  }

  async getNextRequestCode({ branchId, date }) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const d = date ? new Date(date) : new Date();
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'date khong hop le');
    const code = await this.exportRequestRepository.getNextRequestCode(Number(branchId), d);
    return { requestCode: code, date: d.toISOString().slice(0, 10) };
  }

  /**
   * Lay danh sach Repair Order co the xuat kho (chua xuat hoac xuat mot phan).
   */
  async listExportableRepairOrders({ branchId, search, page, limit } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const [items, total] = await Promise.all([
      this.exportRequestRepository.findExportableRepairOrders({
        branchId: Number(branchId),
        search: search || undefined,
        page: safePage,
        limit: safeLimit,
      }),
      this.exportRequestRepository.countExportableRepairOrders({
        branchId: Number(branchId),
        search: search || undefined,
      }),
    ]);
    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  /**
   * Lay chi tiet 1 Repair Order + phu tung (PART) de hien thi trong form xuat.
   */
  async getRepairOrderForExport(repairOrderId) {
    const numId = Number(repairOrderId);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'repairOrderId khong hop le');
    }
    const data = await this.exportRequestRepository.findRepairOrderForExport(numId);
    if (!data) throw new ApiError(404, 'Khong tim thay lenh sua chua');
    return data;
  }

  /**
   * Tao phieu xuat (1 transaction):
   *   1) INSERT export_requests (status='completed')
   *   2) INSERT export_request_items (snapshot)
   *   3) UPDATE products.stock_quantity -= quantity (CHECK stock >= quantity)
   *   4) INSERT inventory_transactions (type='export')
   * Neu loi (stock khong du, FK sai...) -> rollback.
   */
  async create(payload) {
    const data = validateCreateExportRequest(payload);
    const requestCode = await this.exportRequestRepository.getNextRequestCode(
      data.branch_id,
      data.export_date,
    );

    const result = await runInTransaction(async (tx) => {
      return this.exportRequestRepository.create(tx, {
        ...data,
        request_code: requestCode,
      }, data.items);
    });

    return ExportRequestResponseDto.fromEntity(result.request, result.items);
  }
}

module.exports = ExportRequestService;