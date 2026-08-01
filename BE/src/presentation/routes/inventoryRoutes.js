const express = require('express');
const { makeInventoryService } = require('../../application/services');
const InventoryController = require('../controllers/InventoryController');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

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
  router.get('/products/search', authenticate, trackActivity, controller.searchProducts);
  // Dashboard: phu tung duoc su dung nhieu nhat - can req.user.branchId nen
  // phai qua authenticate. Dat truoc /:productId/:branchId cung ly do tren.
  router.get('/top-used-parts', authenticate, controller.getTopUsedParts);
  router.get('/:productId/:branchId', controller.getStockDetail);
  // PATCH /:productId/adjust - tam thoi KHONG mount, vi stock se duoc dieu chinh
  // thong qua phieu nhap / phieu xuat o phase sau.
  // router.patch('/:productId/adjust', controller.adjustStock);

  return router;
}

module.exports = buildInventoryRouter;
