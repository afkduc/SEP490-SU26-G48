const express = require('express');
const { makeInventoryService } = require('../../application/services');
const InventoryController = require('../controllers/InventoryController');
const { authenticate } = require('../../middlewares/auth');

function makeInventoryController() {
  return new InventoryController({ inventoryService: makeInventoryService() });
}

function buildInventoryRouter() {
  const router = express.Router();
  const controller = makeInventoryController();

  router.get('/', controller.getStockList);
  router.get('/low-stock', controller.getLowStock);
  router.get('/summary', controller.getStockSummary);
  // Dat truoc /:productId/:branchId de khong bi nuot mat bo dinh tuyen.
  router.get('/products/search', authenticate, controller.searchProducts);
  router.get('/:productId/:branchId', controller.getStockDetail);
  router.patch('/:productId/adjust', controller.adjustStock);

  return router;
}

module.exports = buildInventoryRouter;
