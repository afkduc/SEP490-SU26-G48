const express = require('express');
const { makeProductService } = require('../../application/services');
const ProductController = require('../controllers/ProductController');
const { authenticate, authorize } = require('../../middlewares/auth');

function makeProductController() {
  return new ProductController({ productService: makeProductService() });
}

function buildProductRouter() {
  const router = express.Router();
  const controller = makeProductController();

  router.use(authenticate);

  router.get('/categories', controller.getCategories);
  router.get('/', controller.getAll);
  router.get('/units', controller.listUnits);
  router.get('/:id', controller.getById);

  // Ghi dữ liệu: theo role kho / quản lý / admin (không dùng ma trận screen:*)
  const canManageProducts = authorize('warehouse_staff', 'manager', 'admin');
  router.post('/', canManageProducts, controller.create);
  router.put('/:id', canManageProducts, controller.update);
  router.delete('/:id', canManageProducts, controller.remove);
  router.patch('/:id/reactivate', canManageProducts, controller.reactivate);

  return router;
}

module.exports = buildProductRouter;
