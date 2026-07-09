const express = require('express');
const { makeInventoryService } = require('../../application/services');
const InventoryController = require('../controllers/InventoryController');

function makeInventoryController() {
  return new InventoryController({ inventoryService: makeInventoryService() });
}

function buildInventoryRouter() {
  const router = express.Router();
  const controller = makeInventoryController();

  router.get('/', controller.getStockList);
  router.get('/low-stock', controller.getLowStock);
  router.get('/summary', controller.getStockSummary);
  router.get('/:productId/:branchId', controller.getStockDetail);
  router.patch('/:productId/adjust', controller.adjustStock);

  return router;
}

module.exports = buildInventoryRouter;
