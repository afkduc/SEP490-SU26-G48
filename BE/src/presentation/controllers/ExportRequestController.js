const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const ApiError = require('../../utils/ApiError');
const NotificationService = require('../../application/services/NotificationService');

/**
 * Controller cho NV Kho (Warehouse Staff) xu ly phieu xuat kho.
 * Khac ImportRequest:
 *   - KHONG co approve/reject (NV tu xuat).
 *   - Co them 2 endpoint dac thu:
 *     GET  /repair-orders/exportable  - list RO co the xuat
 *     GET  /repair-orders/:id/for-export - lay 1 RO + tasks (PART) de fill form
 */
class ExportRequestController {
  constructor({ exportRequestService }) {
    this.exportRequestService = exportRequestService;
    this.notificationService = new NotificationService();
  }

  list = async (req, res, next) => {
    try {
      const { branchId, status, repairOrderId, serviceOrderId, fromDate, toDate, search, page, limit } = req.query;
      const branchIdToUse = branchId ? Number(branchId) : req.user?.branchId;
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.exportRequestService.list({
        branchId: branchIdToUse,
        status, repairOrderId, serviceOrderId, fromDate, toDate, search, page, limit,
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
   * GET /api/export-requests/repair-orders/exportable
   * List cac Repair Order co the xuat kho.
   */
  listExportableRepairOrders = async (req, res, next) => {
    try {
      const { branchId, search, page, limit } = req.query;
      const branchIdToUse = branchId ? Number(branchId) : req.user?.branchId;
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.exportRequestService.listExportableRepairOrders({
        branchId: branchIdToUse,
        search, page, limit,
      });
      return success(res, result, 'Exportable repair orders retrieved');
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/export-requests/repair-orders/:id/for-export
   * Lay chi tiet 1 RO + cac phu tung (PART) de fill form xuat.
   */
  getRepairOrderForExport = async (req, res, next) => {
    try {
      const data = await this.exportRequestService.getRepairOrderForExport(req.params.id);
      return success(res, data, 'Repair order for export retrieved');
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
      await auditCrud.create(req, {
        tableName: 'export_requests',
        entityCode: created?.request_code || created?.code || null,
        recordId: created?.id || null,
        entityName: 'Phiếu xuất kho',
        data: req.body,
      });
      await this.notificationService.notifyAdmins('EXPORT_REQUEST_CREATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: created?.request_code || created?.code || `ID-${created?.id}`,
        targetCode: created?.request_code || created?.code || '',
        userId: created?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[ExportRequestController] notifyAdmins:', e.message));
      return success(res, created, 'Export request created', 201);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ExportRequestController;