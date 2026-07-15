const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');

/**
 * Controller cho NV Kho (Warehouse Staff) xu ly phieu xuat kho.
 * Khac ImportRequest:
 *   - KHONG co approve/reject (NV tu xuat).
 *   - Co them 2 endpoint dac thu:
 *     GET  /service-orders/exportable  - list SO co the xuat
 *     GET  /service-orders/:id/for-export - lay 1 SO + items de fill form
 */
class ExportRequestController {
  constructor({ exportRequestService }) {
    this.exportRequestService = exportRequestService;
  }

  list = async (req, res, next) => {
    try {
      const { branchId, status, serviceOrderId, fromDate, toDate, search, page, limit } = req.query;
      const branchIdToUse = branchId ? Number(branchId) : req.user?.branchId;
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.exportRequestService.list({
        branchId: branchIdToUse,
        status, serviceOrderId, fromDate, toDate, search, page, limit,
      });
      return success(res, result, 'Export requests retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.exportRequestService.getById(req.params.id);
      return success(res, data, 'Export request retrieved');
    } catch (err) {
      next(err);
    }
  };

  getNextCode = async (req, res, next) => {
    try {
      const { branchId, date } = req.query;
      const branchIdToUse = branchId ? Number(branchId) : req.user?.branchId;
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const data = await this.exportRequestService.getNextRequestCode({
        branchId: branchIdToUse,
        date,
      });
      return success(res, data, 'Next request code generated');
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/export-requests/service-orders/exportable
   * List cac Service Order co the xuat kho.
   */
  listExportableServiceOrders = async (req, res, next) => {
    try {
      const { branchId, search, page, limit } = req.query;
      const branchIdToUse = branchId ? Number(branchId) : req.user?.branchId;
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.exportRequestService.listExportableServiceOrders({
        branchId: branchIdToUse,
        search, page, limit,
      });
      return success(res, result, 'Exportable service orders retrieved');
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/export-requests/service-orders/:id/for-export
   * Lay chi tiet 1 SO + cac phu tung (PART) de fill form xuat.
   */
  getServiceOrderForExport = async (req, res, next) => {
    try {
      const data = await this.exportRequestService.getServiceOrderForExport(req.params.id);
      return success(res, data, 'Service order for export retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const performedBy = req.user?.userId;
      if (!performedBy) {
        throw new ApiError(401, 'Khong xac dinh user');
      }
      const payload = { ...req.body, performedBy };
      if (!payload.branchId && req.user?.branchId) {
        payload.branchId = req.user.branchId;
      }
      const created = await this.exportRequestService.create(payload);
      return success(res, created, 'Export request created', 201);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ExportRequestController;