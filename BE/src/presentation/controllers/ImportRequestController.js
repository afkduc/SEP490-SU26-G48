const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');

class ImportRequestController {
  constructor({ importRequestService }) {
    this.importRequestService = importRequestService;
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
      // Neu client khong truyen branchId thi lay tu token.
      const payload = { ...req.body, requestedBy };
      if (!payload.branchId && req.user?.branchId) {
        payload.branchId = req.user.branchId;
      }
      const created = await this.importRequestService.create(payload);
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
      return success(res, data, 'Import request rejected');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ImportRequestController;