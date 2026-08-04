const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');
const ApiError = require('../../utils/ApiError');

const GLOBAL_BRANCH_ROLES = new Set(['admin', 'general_director']);

function getUserRoles(user) {
  return Array.isArray(user?.roles) && user.roles.length
    ? user.roles
    : [user?.primaryRole].filter(Boolean);
}

function resolveInventoryBranchId(user, requestedBranchId) {
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

  const hasGlobalAccess = getUserRoles(user).some((role) => GLOBAL_BRANCH_ROLES.has(role));
  return hasGlobalAccess ? (explicitBranchId || tokenBranchId || null) : (tokenBranchId || explicitBranchId || null);
}

class InventoryController {
  constructor({ inventoryService }) {
    this.inventoryService = inventoryService;
    this.notificationService = new NotificationService();
  }

  getStockList = async (req, res, next) => {
    try {
      const { branchId, search, category, lowStockOnly, page = 1, limit = 20 } = req.query;
      const branchIdToUse = resolveInventoryBranchId(req.user, branchId);
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.inventoryService.getStockList({
        branchId: branchIdToUse,
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
      const branchIdToUse = resolveInventoryBranchId(req.user, branchId);
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.inventoryService.getLowStockList(branchIdToUse);
      return success(res, result, 'Low stock list retrieved');
    } catch (err) {
      next(err);
    }
  };

  getStockDetail = async (req, res, next) => {
    try {
      const { productId, branchId } = req.params;
      const branchIdToUse = resolveInventoryBranchId(req.user, branchId);
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.inventoryService.getStockDetail(
        Number(productId),
        branchIdToUse,
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
      const qtyNum = Number(quantity);
      if (!Number.isFinite(qtyNum)) {
        return res.status(400).json({
          success: false,
          message: 'quantity must be a finite number',
        });
      }
      const result = await this.inventoryService.adjustStock(
        Number(productId),
        Number(branchId),
        qtyNum,
      );
      await auditCrud.update(req, {
        tableName: 'inventory_transactions',
        entityCode: result?.transaction_code || null,
        recordId: result?.id || null,
        entityName: 'Tồn kho',
        newData: { productId: Number(productId), branchId: Number(branchId), quantity: qtyNum },
        description: `Điều chỉnh tồn kho sản phẩm ID ${productId} tại chi nhánh ${branchId}: ${qtyNum > 0 ? '+' : ''}${qtyNum}`,
      });
      return success(res, result, 'Stock adjusted');
    } catch (err) {
      next(err);
    }
  };

  getStockSummary = async (req, res, next) => {
    try {
      const { branchId } = req.query;
      const branchIdToUse = resolveInventoryBranchId(req.user, branchId);
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.inventoryService.getStockSummary(branchIdToUse);
      return success(res, result, 'Stock summary retrieved');
    } catch (err) {
      next(err);
    }
  };

  searchProducts = async (req, res, next) => {
    try {
      const branchIdToUse = resolveInventoryBranchId(req.user, req.query.branchId);
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.inventoryService.searchProducts(req.query.q, branchIdToUse);
      return success(res, result, 'Tìm kiếm phụ tùng thành công');
    } catch (err) {
      next(err);
    }
  };

  getTopUsedParts = async (req, res, next) => {
    try {
      const { branchId, fromDate, toDate, limit } = req.query;
      const branchIdToUse = resolveInventoryBranchId(req.user, branchId);
      if (!branchIdToUse) {
        throw new ApiError(400, 'branchId is required');
      }
      const result = await this.inventoryService.getTopUsedPartsStats({
        branchId: branchIdToUse,
        fromDate,
        toDate,
        limit: limit ? Number(limit) : undefined,
      });
      return success(res, result, 'Thống kê phụ tùng sử dụng nhiều nhất');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = InventoryController;
