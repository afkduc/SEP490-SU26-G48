const { success } = require('../../utils/response');

/**
 * Controller cho Manager xem phieu xuat kho (read-only).
 * Manager KHONG duyet phieu xuat (NVKho tu xuat truc tiep).
 * Muc dich: Manager theo doi, audit.
 *
 * Reuse toan bo ExportRequestService.
 */
class ManagerExportRequestController {
  constructor({ exportRequestService }) {
    this.exportRequestService = exportRequestService;
  }

  list = async (req, res, next) => {
    try {
      const { branchId, status, serviceOrderId, fromDate, toDate, search, page, limit } = req.query;
      const branchIdToUse = branchId
        ? Number(branchId)
        : req.user?.branchId;
      if (!branchIdToUse) {
        return success(res, { items: [], total: 0, page: 1, limit: 20 }, 'No branch context');
      }
      const result = await this.exportRequestService.list({
        branchId: branchIdToUse,
        status, serviceOrderId, fromDate, toDate, search, page, limit,
      });
      return success(res, result, 'Lay danh sach phieu xuat thanh cong');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.exportRequestService.getById(req.params.id);
      return success(res, data, 'Lay chi tiet phieu xuat thanh cong');
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/manager/export-requests/new-count
   * So phieu xuat chua duoc Manager xem (dung cho badge do tren Navbar).
   */
  getNewCount = async (req, res, next) => {
    try {
      const branchIdToUse = req.query.branchId ? Number(req.query.branchId) : req.user?.branchId;
      if (!branchIdToUse) {
        return success(res, { count: 0 }, 'No branch context');
      }
      const count = await this.exportRequestService.countNewForManager(branchIdToUse);
      return success(res, { count }, 'Lay so luong phieu xuat moi thanh cong');
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/manager/export-requests/:id/mark-seen
   * Danh dau 1 phieu xuat la "da xem" (goi khi Manager mo trang chi tiet).
   */
  markSeen = async (req, res, next) => {
    try {
      await this.exportRequestService.markSeenByManager(req.params.id);
      return success(res, { id: Number(req.params.id) }, 'Da danh dau da xem');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ManagerExportRequestController;