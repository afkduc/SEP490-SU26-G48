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
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}

module.exports = buildProductRouter;
