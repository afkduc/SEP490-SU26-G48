const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const ApiError = require('../../utils/ApiError');
const NotificationService = require('../../application/services/NotificationService');

const GLOBAL_BRANCH_ROLES = new Set(['admin', 'general_director']);

function getUserRoles(user) {
  return Array.isArray(user?.roles) && user.roles.length
    ? user.roles
    : [user?.primaryRole].filter(Boolean);
}

function hasGlobalBranchAccess(user) {
  return getUserRoles(user).some((role) => GLOBAL_BRANCH_ROLES.has(role));
}

function hasRole(user, roleName) {
  return getUserRoles(user).includes(roleName);
}

function resolveRequestedBranchId(user, requestedBranchId) {
  const explicitBranchId = requestedBranchId == null || requestedBranchId === ''
    ? null
    : Number(requestedBranchId);
  if (explicitBranchId != null && (!Number.isFinite(explicitBranchId) || explicitBranchId <= 0)) {
    throw new ApiError(400, 'branchId khong hop le');
  }

  const tokenBranchId = user?.branchId == null ? null : Number(user.branchId);
  if (tokenBranchId != null && (!Number.isFinite(tokenBranchId) || tokenBranchId <= 0)) {
    throw new ApiError(400, 'branchId trong token khong hop le');
  }

  if (hasGlobalBranchAccess(user)) {
    return explicitBranchId || tokenBranchId || null;
  }

  return tokenBranchId || explicitBranchId || null;
}

function getBranchScope(user) {
  if (hasGlobalBranchAccess(user)) return null;
  const branchId = user?.branchId == null ? null : Number(user.branchId);
  return Number.isFinite(branchId) && branchId > 0 ? branchId : null;
}

class ImportRequestController {
  constructor({ importRequestService }) {
    this.importRequestService = importRequestService;
    this.notificationService = new NotificationService();
  }

  list = async (req, res, next) => {
    try {
      const { branchId, status, supplierId, fromDate, toDate, search, page, limit } = req.query;
      const branchIdToUse = resolveRequestedBranchId(req.user, branchId);
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.importRequestService.list({
        branchId: branchIdToUse,
        status: hasRole(req.user, 'warehouse_staff') ? 'approved' : status,
        supplierId, fromDate, toDate, search, page, limit,
      });
      return success(res, result, 'Import requests retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.importRequestService.getById(req.params.id, {
        branchId: getBranchScope(req.user),
      });
      return success(res, data, 'Import request retrieved');
    } catch (err) {
      next(err);
    }
  };

  getNextCode = async (req, res, next) => {
    try {
      const { branchId } = req.query;
      const branchIdToUse = resolveRequestedBranchId(req.user, branchId);
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const data = await this.importRequestService.getNextRequestCode({
        branchId: branchIdToUse,
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
      const branchId = resolveRequestedBranchId(req.user, req.body?.branchId);
      if (!branchId) {
        throw new ApiError(400, 'branchId is required');
      }

      const autoApprove = hasRole(req.user, 'warehouse_staff');
      const payload = { ...req.body, branchId, requestedBy };
      const created = await this.importRequestService.create(payload, {
        autoApprove,
        approvedBy: autoApprove ? requestedBy : undefined,
      });
      await auditCrud.create(req, {
        tableName: 'import_requests',
        entityCode: created?.requestCode || created?.code || null,
        recordId: created?.id || null,
        entityName: 'Phiếu nhập kho',
        data: { ...req.body, branchId },
      });
      return success(
        res,
        created,
        autoApprove
          ? 'Import request created and inventory updated'
          : 'Import request created',
        201,
      );
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
      const data = await this.importRequestService.approve(req.params.id, {
        approvedBy,
        branchId: getBranchScope(req.user),
      });
      await auditCrud.update(req, {
        tableName: 'import_requests',
        entityCode: data?.requestCode || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Phiếu nhập kho',
        newData: { status: 'approved' },
        description: `Duyệt phiếu nhập kho ${data?.requestCode || req.params.id}`,
      });
      await this.notificationService.notifyAdmins('IMPORT_REQUEST_APPROVED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: data?.requestCode || `ID-${req.params.id}`,
        targetCode: data?.requestCode || '',
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
      const data = await this.importRequestService.reject(req.params.id, req.body, {
        rejectedBy,
        branchId: getBranchScope(req.user),
      });
      await auditCrud.update(req, {
        tableName: 'import_requests',
        entityCode: data?.requestCode || `ID-${req.params.id}`,
        recordId: data?.id || Number(req.params.id) || null,
        entityName: 'Phiếu nhập kho',
        newData: { status: 'rejected', reason: req.body?.rejectReason },
        description: `Từ chối phiếu nhập kho ${data?.requestCode || req.params.id}`,
      });
      await this.notificationService.notifyAdmins('IMPORT_REQUEST_REJECTED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: data?.requestCode || `ID-${req.params.id}`,
        targetCode: data?.requestCode || '',
        userId: data?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[ImportRequestController] notifyAdmins:', e.message));
      return success(res, data, 'Import request rejected');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ImportRequestController;
