const ApiError = require('../../utils/ApiError');
const ImportRequestResponseDto = require('../dto/ImportRequestResponseDto');
const { validateCreateImportRequest, validateReject } = require('../dto/ImportRequestCreateDto');
const { runInTransaction } = require('../../utils/sqlTransaction');

/**
 * Service cho Import Request.
 * Chiu trach nhiem validate nghiep vu + dong goi repository, dam bao
 * transaction khi approve.
 */
class ImportRequestService {
  constructor({ importRequestRepository }) {
    this.importRequestRepository = importRequestRepository;
  }

  async list({ branchId, status, supplierId, fromDate, toDate, search, page, limit } = {}) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const filters = {
      branchId: Number(branchId),
      status: status || undefined,
      supplierId: supplierId ? Number(supplierId) : undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
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

  async getById(id) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    const result = await this.importRequestRepository.findById(numId);
    if (!result) throw new ApiError(404, 'Khong tim thay phieu nhap');
    return ImportRequestResponseDto.fromEntity(result.request, result.items);
  }

  async getNextRequestCode({ branchId, date }) {
    if (!branchId) throw new ApiError(400, 'branchId is required');
    const d = date ? new Date(date) : new Date();
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'date khong hop le');
    const code = await this.importRequestRepository.getNextRequestCode(Number(branchId), d);
    return { requestCode: code, date: d.toISOString().slice(0, 10) };
  }

  /**
   * Tao phieu moi (status='pending'). Toan bo trong 1 transaction.
   */
  async create(payload) {
    const data = validateCreateImportRequest(payload);
    const requestCode = await this.importRequestRepository.getNextRequestCode(
      data.branch_id,
      data.import_date,
    );

    const newId = await runInTransaction(async (tx) => {
      return this.importRequestRepository.create(tx, {
        ...data,
        request_code: requestCode,
      }, data.items);
    });

    return this.getById(newId);
  }

  /**
   * Duyet phieu: 1 transaction duy nhat
   *   1) UPDATE import_requests status='approved'
   *   2) Cong stock_quantity cho moi item
   *   3) INSERT 1 dong inventory_transactions (type='import') cho moi item
   * Neu loi o buoc nao -> rollback toan bo.
   */
  async approve(id, { approvedBy }) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    if (!approvedBy) {
      throw new ApiError(400, 'approvedBy is required');
    }

    const approved = await runInTransaction(async (tx) => {
      return this.importRequestRepository.approve(tx, numId, Number(approvedBy), new Date());
    });
    if (!approved) {
      throw new ApiError(409, 'Phieu khong o trang thai pending hoac khong ton tai');
    }

    return this.getById(numId);
  }

  /**
   * Tu choi phieu (khoa trang thai pending).
   */
  async reject(id, payload, { rejectedBy: _rejectedBy } = {}) {
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) {
      throw new ApiError(400, 'id khong hop le');
    }
    const reason = validateReject(payload);

    const ok = await runInTransaction(async (tx) => {
      return this.importRequestRepository.reject(tx, numId, null, reason);
    });
    if (!ok) {
      throw new ApiError(409, 'Phieu khong o trang thai pending hoac khong ton tai');
    }
    return this.getById(numId);
  }
}

module.exports = ImportRequestService;