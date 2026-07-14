const { success } = require('../../utils/response');

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
}

module.exports = CustomerController;
