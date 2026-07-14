const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');

class CustomerController {
  constructor({ customerService }) {
    this.customerService = customerService;
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
      return success(res, item, 'Customer updated');
    } catch (err) {
      next(err);
    }
  };

  importExcel = async (req, res, next) => {
    try {
      if (!req.file) throw new ApiError(400, 'Vui lòng chọn file Excel (.xlsx)');
      const result = await this.customerService.importFromExcel(req.file.buffer);
      return success(res, result, 'Import khách hàng hoàn tất');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = CustomerController;
