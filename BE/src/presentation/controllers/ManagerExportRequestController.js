const { success } = require('../../utils/response');

function getManagerBranchScope(user) {
  const roles = Array.isArray(user?.roles) && user.roles.length
    ? user.roles
    : [user?.primaryRole].filter(Boolean);
  if (roles.includes('admin')) return null;
  const branchId = user?.branchId == null ? null : Number(user.branchId);
  return Number.isFinite(branchId) && branchId > 0 ? branchId : null;
}

function resolveManagerBranchId(user, requestedBranchId) {
  const branchScope = getManagerBranchScope(user);
  if (branchScope) return branchScope;
  const explicitBranchId = requestedBranchId == null || requestedBranchId === ''
    ? null
    : Number(requestedBranchId);
  return Number.isFinite(explicitBranchId) && explicitBranchId > 0 ? explicitBranchId : null;
}

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
      const { branchId, status, fromDate, toDate, search, page, limit } = req.query;
      const branchIdToUse = resolveManagerBranchId(req.user, branchId);
      if (!branchIdToUse) {
        return success(res, { items: [], total: 0, page: 1, limit: 20 }, 'No branch context');
      }
      const result = await this.exportRequestService.list({
        branchId: branchIdToUse,
        status, fromDate, toDate, search, page, limit,
      });
      return success(res, result, 'Lay danh sach phieu xuat thanh cong');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.exportRequestService.getById(req.params.id, {
        branchId: getManagerBranchScope(req.user),
      });
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
      const branchIdToUse = resolveManagerBranchId(req.user, req.query.branchId);
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
      await this.exportRequestService.markSeenByManager(req.params.id, {
        branchId: getManagerBranchScope(req.user),
      });
      return success(res, { id: Number(req.params.id) }, 'Da danh dau da xem');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ManagerExportRequestController;
