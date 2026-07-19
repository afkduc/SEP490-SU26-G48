const { success } = require('../../utils/response');

class ProductController {
  constructor({ productService }) {
    this.productService = productService;
  }

  listUnits = async (req, res, next) => {
    try {
      const units = await this.productService.listUnits();
      return success(res, units, 'Units retrieved');
    } catch (err) {
      next(err);
    }
  };

  getAll = async (req, res, next) => {
    try {
      const { branchId, status, search, category, page = 1, limit = 20 } = req.query;
      const result = await this.productService.getAllProducts({
        branchId: branchId ? Number(branchId) : undefined,
        status,
        search,
        category,
        page: Number(page),
        limit: Number(limit),
      });
      return success(res, result, 'Products retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const product = await this.productService.getProductById(req.params.id);
      return success(res, product, 'Product retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const payload = { ...req.body };
      // Neu client khong truyen branchId thi lay tu token (neu co).
      if (!payload.branchId && req.user?.branchId) {
        payload.branchId = req.user.branchId;
      }
      const product = await this.productService.createProduct(payload);
      return success(res, product, 'Product created', 201);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const product = await this.productService.updateProduct(req.params.id, req.body);
      return success(res, product, 'Product updated');
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const product = await this.productService.deleteProduct(req.params.id);
      return success(res, product, 'Product deleted');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ProductController;
