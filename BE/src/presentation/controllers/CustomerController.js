const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

class CustomerController {
  constructor({ customerService }) {
    this.customerService = customerService;
    this.notificationService = new NotificationService();
  }

  getAll = async (req, res, next) => {
    try {
      const { search, page = 1, limit = 20 } = req.query;
      const result = await this.customerService.getAll({ search, page: Number(page), limit: Number(limit) });
      return success(res, result, 'Customers retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const item = await this.customerService.getById(req.params.id);
      return success(res, item, 'Customer retrieved');
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const item = await this.customerService.update(req.params.id, req.body);
      await auditCrud.update(req, {
        tableName: 'customers',
        entityCode: item?.customer_code || `ID-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Khách hàng',
        newData: req.body,
      });
      await this.notificationService.notifyAdmins('CUSTOMER_UPDATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.name || item?.full_name || `ID-${req.params.id}`,
        targetCode: item?.customer_code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[CustomerController] notifyAdmins:', e.message));
      return success(res, item, 'Customer updated');
    } catch (err) {
      next(err);
    }
  };

  importExcel = async (req, res, next) => {
    try {
      if (!req.file) throw new ApiError(400, 'Vui lòng chọn file Excel (.xlsx)');
      const result = await this.customerService.importFromExcel(req.file.buffer);
      await auditCrud.import(req, {
        fileName: req.file.originalname,
        dataType: 'customers',
        recordCount: result?.imported || result?.total || null,
      });
      return success(res, result, 'Import khách hàng hoàn tất');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = CustomerController;
