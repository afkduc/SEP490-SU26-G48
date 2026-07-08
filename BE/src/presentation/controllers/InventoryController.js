const { success } = require('../../utils/response');

class InventoryController {
  constructor({ inventoryService }) {
    this.inventoryService = inventoryService;
  }

  getStockList = async (req, res, next) => {
    try {
      const { branchId, search, category, lowStockOnly, page = 1, limit = 20 } = req.query;
      const result = await this.inventoryService.getStockList({
        branchId: branchId ? Number(branchId) : undefined,
        search,
        category,
        lowStockOnly: lowStockOnly === 'true',
        page: Number(page),
        limit: Number(limit),
      });
      return success(res, result, 'Stock list retrieved');
    } catch (err) {
      next(err);
    }
  };

  getLowStock = async (req, res, next) => {
    try {
      const { branchId } = req.query;
      const result = await this.inventoryService.getLowStockList(
        branchId ? Number(branchId) : undefined
      );
      return success(res, result, 'Low stock list retrieved');
    } catch (err) {
      next(err);
    }
  };

  getStockDetail = async (req, res, next) => {
    try {
      const { productId, branchId } = req.params;
      const result = await this.inventoryService.getStockDetail(
        Number(productId),
        Number(branchId)
      );
      return success(res, result, 'Stock detail retrieved');
    } catch (err) {
      next(err);
    }
  };

  adjustStock = async (req, res, next) => {
    try {
      const { productId } = req.params;
      const { branchId, quantity } = req.body;
      const result = await this.inventoryService.adjustStock(
        Number(productId),
        Number(branchId),
        Number(quantity)
      );
      return success(res, result, 'Stock adjusted');
    } catch (err) {
      next(err);
    }
  };

  getStockSummary = async (req, res, next) => {
    try {
      const { branchId } = req.query;
      const result = await this.inventoryService.getStockSummary(
        branchId ? Number(branchId) : undefined
      );
      return success(res, result, 'Stock summary retrieved');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = InventoryController;
