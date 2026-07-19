const { success } = require('../../utils/response');

/**
 * Controller rieng cho Manager xem & duyet phieu nhap kho.
 * Usecase: Manager truy cap /manager/import-requests ... de duyet phieu
 * cua chi nhanh minh quan ly (KHONG can vao module /inventory).
 *
 * Reuse toan bo ImportRequestService (transaction duyet -> cong stock).
 */
class ManagerImportRequestController {
  constructor({ importRequestService }) {
    this.importRequestService = importRequestService;
  }

  /**
   * GET /api/manager/import-requests
   * Mac dinh loc theo branchId trong token (chi nhanh manager quan ly).
   * Neu user co role global (admin), co the truyen ?branchId= de xem toan bo.
   */
  list = async (req, res, next) => {
    try {
      const { branchId, status, supplierId, fromDate, toDate, search, page, limit } = req.query;
      // Manager chi xem cua chi nhanh minh quan ly; admin duoc phep truyen branchId tu frontend.
      const branchIdToUse = branchId
        ? Number(branchId)
        : (req.user?.roles?.includes('admin') ? req.user?.branchId : req.user?.branchId);
      if (!branchIdToUse) {
        return success(res, { items: [], total: 0, page: 1, limit: 20 }, 'No branch context');
      }
      const result = await this.importRequestService.list({
        branchId: branchIdToUse,
        status, supplierId, fromDate, toDate, search, page, limit,
      });
      return success(res, result, 'Lay danh sach phieu nhap thanh cong');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.importRequestService.getById(req.params.id);
      return success(res, data, 'Lay chi tiet phieu nhap thanh cong');
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/manager/import-requests/:id/approve
   * Transaction trong service: update phieu + cong stock + ghi log.
   */
  approve = async (req, res, next) => {
    try {
      const approvedBy = req.user?.userId;
      if (!approvedBy) {
        return res.status(401).json({ success: false, message: 'Khong xac dinh user' });
      }
      const data = await this.importRequestService.approve(req.params.id, { approvedBy });
      return success(res, data, 'Duyet phieu nhap thanh cong');
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/manager/import-requests/:id/reject
   * Body: { rejectReason }
   */
  reject = async (req, res, next) => {
    try {
      const rejectedBy = req.user?.userId;
      if (!rejectedBy) {
        return res.status(401).json({ success: false, message: 'Khong xac dinh user' });
      }
      const data = await this.importRequestService.reject(
        req.params.id,
        req.body,
        { rejectedBy },
      );
      return success(res, data, 'Tu choi phieu nhap thanh cong');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ManagerImportRequestController;