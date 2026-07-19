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
}

module.exports = ManagerExportRequestController;