const ApiError = require('../../utils/ApiError');
const ImportRequestResponseDto = require('../dto/ImportRequestResponseDto');
const { validateCreateImportRequest, validateReject } = require('../dto/ImportRequestCreateDto');
const { runInTransaction } = require('../../utils/sqlTransaction');
const { normalizeDateRange } = require('../../utils/dateRange');

/**
 * Service cho Import Request.
 * Chiu trach nhiem validate nghiep vu + dong goi repository, dam bao
 * transaction khi approve.
 */
class ImportRequestService {
  constructor({ importRequestRepository, transactionRunner = runInTransaction }) {
    this.importRequestRepository = importRequestRepository;
    this.transactionRunner = transactionRunner;
  }

  async list({ branchId, status, supplierId, fromDate, toDate, search, page, limit } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const dateRange = normalizeDateRange(fromDate, toDate);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const filters = {
      branchId: Number(branchId),
      status: status || undefined,
      supplierId: supplierId ? Number(supplierId) : undefined,
      ...dateRange,
      search: search || undefined,
    };
    const [items, total] = await Promise.all([
      this.importRequestRepository.findAll({ ...filters, page: safePage, limit: safeLimit }),
      this.importRequestRepository.count(filters),
    ]);
    return {
      items: ImportRequestResponseDto.fromEntityList(items),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getById(id, { branchId } = {}) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    const scopedBranchId = branchId == null ? undefined : Number(branchId);
    const result = await this.importRequestRepository.findById(numId, { branchId: scopedBranchId });
    if (!result) throw new ApiError(404, 'Khong tim thay phieu nhap');
    return ImportRequestResponseDto.fromEntity(result.request, result.items);
  }

  async getNextRequestCode({ branchId }) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const d = new Date();
    const code = await this.importRequestRepository.getNextRequestCode(Number(branchId), d);
    return { requestCode: code, date: d.toISOString().slice(0, 10) };
  }

  /**
   * Tao phieu moi. Warehouse staff co the duoc hoan tat ngay trong cung transaction.
   */
  async create(payload, { autoApprove = false, approvedBy } = {}) {
    const data = validateCreateImportRequest(payload);

    const newId = await this.transactionRunner(async (tx) => {
      const requestCode = await this.importRequestRepository.getNextRequestCode(
        data.branch_id,
        data.import_date,
        tx,
      );

      const id = await this.importRequestRepository.create(tx, {
        ...data,
        request_code: requestCode,
      }, data.items);

      if (autoApprove) {
        const approverId = Number(approvedBy);
        if (!Number.isFinite(approverId) || approverId <= 0) {
          throw new ApiError(400, 'approvedBy is required');
        }

        const completed = await this.importRequestRepository.approve(
          tx,
          id,
          approverId,
          data.import_date,
          { branchId: data.branch_id },
        );
        if (!completed) {
          throw new ApiError(409, 'Khong the hoan tat phieu nhap vua tao');
        }
      }

      return id;
    });

    return this.getById(newId, { branchId: data.branch_id });
  }

  /**
   * Duyet phieu: 1 transaction duy nhat
   *   1) UPDATE import_requests status='approved'
   *   2) Cong stock_quantity cho moi item
   *   3) INSERT 1 dong inventory_transactions (type='import') cho moi item
   * Neu loi o buoc nao -> rollback toan bo.
   */
  async approve(id, { approvedBy, branchId } = {}) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    if (!approvedBy) {
      throw new ApiError(400, 'approvedBy is required');
    }

    const approved = await this.transactionRunner(async (tx) => {
      return this.importRequestRepository.approve(
        tx,
        numId,
        Number(approvedBy),
        new Date(),
        { branchId: branchId == null ? undefined : Number(branchId) },
      );
    });
    if (!approved) {
      throw new ApiError(409, 'Phieu khong o trang thai pending hoac khong ton tai');
    }

    return this.getById(numId, { branchId });
  }

  /**
   * Tu choi phieu (khoa trang thai pending).
   */
  async reject(id, payload, { rejectedBy: _rejectedBy, branchId } = {}) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    const reason = validateReject(payload);

    const ok = await this.transactionRunner(async (tx) => {
      return this.importRequestRepository.reject(
        tx,
        numId,
        null,
        reason,
        { branchId: branchId == null ? undefined : Number(branchId) },
      );
    });
    if (!ok) {
      throw new ApiError(409, 'Phieu khong o trang thai pending hoac khong ton tai');
    }
    return this.getById(numId, { branchId });
  }

  /**
   * Danh dau phieu la "da xem" boi Manager (dung cho thong bao dom).
   */
  async markSeenByManager(id) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    await this.importRequestRepository.markSeenByManager(numId);
  }

  /**
   * Dem so phieu nhap chua duoc Manager xem trong 1 chi nhanh.
   */
  async countNewForManager(branchId) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    return this.importRequestRepository.countNewForManager(Number(branchId));
  }
}

module.exports = ImportRequestService;
