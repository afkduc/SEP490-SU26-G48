const express = require('express');
const { makeInventoryService } = require('../../application/services');
const InventoryController = require('../controllers/InventoryController');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');
const { requirePerm } = require('../../middlewares/inventory/rbac');

function makeInventoryController() {
  return new InventoryController({ inventoryService: makeInventoryService() });
}

function buildInventoryRouter() {
  const router = express.Router();
  const controller = makeInventoryController();

  router.use(authenticate);

  router.get('/', requirePerm('stock:read'), controller.getStockList);
  router.get('/low-stock', requirePerm('stock:read'), controller.getLowStock);
  router.get('/summary', requirePerm('stock:read'), controller.getStockSummary);
  // Dat truoc /:productId/:branchId de khong bi nuot mat bo dinh tuyen.
  router.get('/products/search', requirePerm('parts:read'), trackActivity, controller.searchProducts);
  // Dashboard: phu tung duoc su dung nhieu nhat.
  router.get('/top-used-parts', requirePerm('stock:read'), controller.getTopUsedParts);
  router.get('/:productId/:branchId', requirePerm('stock:read'), controller.getStockDetail);
  // PATCH /:productId/adjust - tam thoi KHONG mount, vi stock se duoc dieu chinh
  // thong qua phieu nhap / phieu xuat o phase sau.
  // router.patch('/:productId/adjust', controller.adjustStock);

  return router;
}

module.exports = buildInventoryRouter;
