const express = require('express');
const { makeProductService } = require('../../application/services');
const ProductController = require('../controllers/ProductController');
const { authenticate } = require('../../middlewares/auth');
const { requireScreenAction } = require('../../middlewares/permission');

function makeProductController() {
  return new ProductController({ productService: makeProductService() });
}

function buildProductRouter() {
  const router = express.Router();
  const controller = makeProductController();

  // Tat ca endpoint deu can authen (truoc day thieu -> lo hong: goi duoc
  // ma khong dang nhap). Quyen chi tiet (create/update/delete) gate theo
  // screen 'inventory:products' - khop voi bit da co san trong DB.
  router.use(authenticate);

  router.get('/categories', controller.getCategories);
  router.get('/', controller.getAll);
  router.get('/units', controller.listUnits);
  router.get('/:id', controller.getById);
  router.post('/', requireScreenAction('inventory:products', 'create'), controller.create);
  router.put('/:id', requireScreenAction('inventory:products', 'update'), controller.update);
  // Soft-disable (không hard delete). Giữ DELETE path để FE cũ vẫn gọi được.
  router.delete('/:id', requireScreenAction('inventory:products', 'delete'), controller.remove);
  router.patch('/:id/reactivate', requireScreenAction('inventory:products', 'update'), controller.reactivate);

  return router;
}

module.exports = buildProductRouter;
