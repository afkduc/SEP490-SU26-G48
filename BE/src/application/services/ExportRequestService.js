const ApiError = require('../../utils/ApiError');
const ExportRequestResponseDto = require('../dto/ExportRequestResponseDto');
const { validateConfirmPickup } = require('../dto/ExportRequestCreateDto');
const { runInTransaction } = require('../../utils/sqlTransaction');
const { normalizeDateRange } = require('../../utils/dateRange');

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

  async list({ branchId, status, repairOrderId, fromDate, toDate, search, page, limit } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const dateRange = normalizeDateRange(fromDate, toDate);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const filters = {
      branchId: Number(branchId),
      status: status || undefined,
      repairOrderId: repairOrderId ? Number(repairOrderId) : undefined,
      ...dateRange,
      search: search || undefined,
      // Danh sach chinh chi hien phieu DA XONG (RO da chot). Rieng khi tra
      // cuu dich danh 1 RO thi lay ca phieu dang lam do do la chu dich.
      includeOpen: Boolean(repairOrderId),
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

  async getById(id, { branchId } = {}) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'ID phiếu xuất không hợp lệ');
    }
    const scope = branchId == null ? {} : { branchId: Number(branchId) };
    const result = await this.exportRequestRepository.findById(numId, scope);
    if (!result) throw new ApiError(404, 'Không tìm thấy phiếu xuất');
    return ExportRequestResponseDto.fromEntity(result.request, result.items);
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
      throw new ApiError(400, 'ID lệnh sửa chữa không hợp lệ');
    }
    const data = await this.exportRequestRepository.findRepairOrderForExport(numId);
    if (!data) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa');
    // Khong con chan "da xuat roi" - phieu xuat theo doi lien tuc, chi khoa
    // khi RO da chot (data.locked, tinh o repository).
    return data;
  }

  /**
   * Danh sach tho may cho dropdown "Nguoi lay" khi tao phieu xuat.
   */
  async listTechnicians(branchId) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    return this.exportRequestRepository.findTechnicians(Number(branchId));
  }

  /**
   * Xac nhan 1 lan lay hang (xuat them va/hoac tra hang) - toan bo trong 1
   * transaction, so luong tung dong do SERVER tu tinh lai, FE chi gui danh
   * sach productId duoc tick. Xem repository.confirmPickup().
   */
  async confirmPickup(payload) {
    const data = validateConfirmPickup(payload);
    const result = await runInTransaction(async (tx) => {
      return this.exportRequestRepository.confirmPickup(tx, data);
    });
    return ExportRequestResponseDto.fromEntity(result.request, result.items);
  }

  /**
   * Lich su cac lan lay hang/tra hang cua 1 phieu xuat.
   */
  async getPickups(exportRequestId) {
    const numId = Number(exportRequestId);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    return this.exportRequestRepository.findPickups(numId);
  }

  /**
   * Danh dau phieu la "da xem" boi Manager (dung cho thong bao dom).
   */
  async markSeenByManager(id, { branchId } = {}) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    const scope = branchId == null ? {} : { branchId: Number(branchId) };
    await this.exportRequestRepository.markSeenByManager(numId, scope);
  }

  /**
   * Dem so phieu xuat chua duoc Manager xem trong 1 chi nhanh.
   */
  async countNewForManager(branchId) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    return this.exportRequestRepository.countNewForManager(Number(branchId));
  }
}

module.exports = ExportRequestService;
