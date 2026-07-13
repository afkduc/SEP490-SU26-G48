const { success } = require('../../utils/response');

class SupplierController {
  constructor({ supplierService }) {
    this.supplierService = supplierService;
  }

  getAll = async (req, res, next) => {
    try {
      const { search, status } = req.query;
      const result = await this.supplierService.getSuppliers({ search, status });
      return success(res, result, 'Suppliers retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const supplier = await this.supplierService.getSupplierById(Number(req.params.id));
      return success(res, supplier, 'Supplier retrieved');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = SupplierController;