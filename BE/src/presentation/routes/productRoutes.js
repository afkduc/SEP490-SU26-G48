const express = require('express');
const { makeProductService } = require('../../application/services');
const ProductController = require('../controllers/ProductController');

function makeProductController() {
  return new ProductController({ productService: makeProductService() });
}

function buildProductRouter() {
  const router = express.Router();
  const controller = makeProductController();

  router.get('/categories', controller.getCategories);
  router.get('/', controller.getAll);
  router.get('/units', controller.listUnits);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  // Soft-disable (không hard delete). Giữ DELETE path để FE cũ vẫn gọi được.
  router.delete('/:id', controller.remove);
  router.patch('/:id/reactivate', controller.reactivate);

  return router;
}

module.exports = buildProductRouter;
