const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const ApiError = require('../../utils/ApiError');
const NotificationService = require('../../application/services/NotificationService');

class ImportRequestController {
  constructor({ importRequestService }) {
    this.importRequestService = importRequestService;
    this.notificationService = new NotificationService();
  }

  list = async (req, res, next) => {
    try {
      const { branchId, status, supplierId, fromDate, toDate, search, page, limit } = req.query;
      // Neu user khong truyen branchId -> mac dinh lay theo chi nhanh cua user.
      const branchIdToUse = branchId ? Number(branchId) : req.user?.branchId;
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.importRequestService.list({
        branchId: branchIdToUse,
        status, supplierId, fromDate, toDate, search, page, limit,
      });
      return success(res, result, 'Import requests retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.importRequestService.getById(req.params.id);
      return success(res, data, 'Import request retrieved');
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
      const data = await this.importRequestService.getNextRequestCode({
        branchId: branchIdToUse,
        date,
      });
      return success(res, data, 'Next request code generated');
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const requestedBy = req.user?.userId;
      if (!requestedBy) {
        throw new ApiError(401, 'Khong xac dinh user');
      }
      const payload = { ...req.body, requestedBy };
      if (!payload.branchId && req.user?.branchId) {
        payload.branchId = req.user.branchId;
      }
      const created = await this.importRequestService.create(payload);
      await auditCrud.create(req, {
        tableName: 'import_requests',
        entityCode: created?.request_code || created?.code || null,
        recordId: created?.id || null,
        entityName: 'Phiếu nhập kho',
        data: req.body,
      });
      return success(res, created, 'Import request created', 201);
    } catch (err) {
      next(err);
    }
  };

  approve = async (req, res, next) => {
    try {
      const approvedBy = req.user?.userId;
      if (!approvedBy) {
        throw new ApiError(401, 'Khong xac dinh user');
      }
      const data = await this.importRequestService.approve(req.params.id, { approvedBy });
      await auditCrud.update(req, {
        tableName: 'import_requests',
        entityCode: data?.request_code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Phiếu nhập kho',
        newData: { status: 'approved' },
        description: `Duyệt phiếu nhập kho ${data?.request_code || req.params.id}`,
      });
      await this.notificationService.notifyAdmins('IMPORT_REQUEST_APPROVED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: data?.request_code || `ID-${req.params.id}`,
        targetCode: data?.request_code || '',
        userId: data?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[ImportRequestController] notifyAdmins:', e.message));
      return success(res, data, 'Import request approved');
    } catch (err) {
      next(err);
    }
  };

  reject = async (req, res, next) => {
    try {
      const rejectedBy = req.user?.userId;
      if (!rejectedBy) {
        throw new ApiError(401, 'Khong xac dinh user');
      }
      const data = await this.importRequestService.reject(req.params.id, req.body, { rejectedBy });
      await auditCrud.update(req, {
        tableName: 'import_requests',
        entityCode: data?.request_code || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Phiếu nhập kho',
        newData: { status: 'rejected', reason: req.body?.rejectReason },
        description: `Từ chối phiếu nhập kho ${data?.request_code || req.params.id}`,
      });
      await this.notificationService.notifyAdmins('IMPORT_REQUEST_REJECTED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: data?.request_code || `ID-${req.params.id}`,
        targetCode: data?.request_code || '',
        userId: data?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[ImportRequestController] notifyAdmins:', e.message));
      return success(res, data, 'Import request rejected');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ImportRequestController;