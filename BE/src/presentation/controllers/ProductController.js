const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');
const { formatEntityName } = require('../../utils/notificationFormat');

class ProductController {
  constructor({ productService }) {
    this.productService = productService;
    this.notificationService = new NotificationService();
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
      const { branchId, status, search, category, lowStockOnly, page = 1, limit = 20 } = req.query;
      const result = await this.productService.getAllProducts({
        branchId: branchId ? Number(branchId) : undefined,
        status,
        search,
        category,
        lowStockOnly: lowStockOnly === 'true' || lowStockOnly === true,
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
      if (!payload.branchId && req.user?.branchId) {
        payload.branchId = req.user.branchId;
      }
      const product = await this.productService.createProduct(payload);
      await auditCrud.create(req, {
        tableName: 'products',
        entityCode: product?.product_code || product?.code || null,
        recordId: product?.id || null,
        entityName: 'Phụ tùng / Sản phẩm',
        data: req.body,
      });
      await this.notificationService.notifyAdmins('PRODUCT_CREATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: formatEntityName(
          product?.name || product?.product_name,
          product?.id,
          'Sản phẩm',
        ),
        targetCode: product?.product_code || product?.code || '',
        userId: product?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[ProductController] notifyAdmins:', e.message));
      return success(res, product, 'Product created', 201);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const product = await this.productService.updateProduct(req.params.id, req.body);
      await auditCrud.update(req, {
        tableName: 'products',
        entityCode: product?.product_code || `ID-${req.params.id}`,
        recordId: product?.id || Number(req.params.id) || null,
        entityName: 'Phụ tùng / Sản phẩm',
        newData: req.body,
      });
      await this.notificationService.notifyAdmins('PRODUCT_UPDATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: formatEntityName(
          product?.name || product?.product_name,
          product?.id || req.params.id,
          'Sản phẩm',
        ),
        targetCode: product?.product_code || product?.code || '',
        userId: product?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[ProductController] notifyAdmins:', e.message));
      return success(res, product, 'Product updated');
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      // Soft-disable: không hard delete. Đồng bộ nghiệp vụ Ngừng/Disable.
      const product = await this.productService.deleteProduct(req.params.id);
      await auditCrud.update(req, {
        tableName: 'products',
        entityCode: product?.product_code || `ID-${req.params.id}`,
        recordId: product?.id || Number(req.params.id) || null,
        entityName: 'Phụ tùng / Sản phẩm',
        newData: { status: 'inactive' },
      });
      await this.notificationService.notifyAdmins('PRODUCT_DISABLED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: formatEntityName(
          product?.name || product?.product_name,
          product?.id || req.params.id,
          'Sản phẩm',
        ),
        targetCode: product?.product_code || product?.code || '',
        userId: Number(req.params.id) || null,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[ProductController] notifyAdmins:', e.message));
      return success(res, product, 'Product deactivated');
    } catch (err) {
      next(err);
    }
  };

  reactivate = async (req, res, next) => {
    try {
      const product = await this.productService.reactivateProduct(req.params.id);
      await auditCrud.update(req, {
        tableName: 'products',
        entityCode: product?.product_code || `ID-${req.params.id}`,
        recordId: product?.id || Number(req.params.id) || null,
        entityName: 'Phụ tùng / Sản phẩm',
        newData: { status: 'active' },
      });
      await this.notificationService.notifyAdmins('PRODUCT_UPDATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: formatEntityName(
          product?.name || product?.product_name,
          product?.id || req.params.id,
          'Sản phẩm',
        ),
        targetCode: product?.product_code || product?.code || '',
        userId: product?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[ProductController] notifyAdmins:', e.message));
      return success(res, product, 'Product reactivated');
    } catch (err) {
      next(err);
    }
  };

  getCategories = async (req, res, next) => {
    try {
      const categories = await this.productService.getCategories();
      return success(res, categories, 'Categories retrieved');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ProductController;
