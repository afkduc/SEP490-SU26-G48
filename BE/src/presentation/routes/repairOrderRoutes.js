const express = require('express');
const { makeRepairOrderService } = require('../../application/services');
const RepairOrderController = require('../controllers/RepairOrderController');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

function makeRepairOrderController() {
  return new RepairOrderController({ repairOrderService: makeRepairOrderService() });
}

// To truong (dang nhap binh thuong tu chinh tai khoan cua ho) nhan viec tu
// bang tin chung ca chi nhanh, gan cho 1 khoang cua minh + tho thuc hien, va
// XAC NHAN HOAN THANH sau khi khoang bao xong viec.
// Tick dau muc/bao xong viec dien ra rieng, tai chinh khoang xe, khong dang
// nhap - xem publicRoutes.js /public/bays/* + PublicBayBoardController.js.
function buildRepairOrderRouter() {
  const router = express.Router();
  const controller = makeRepairOrderController();

  router.use(authenticate, trackActivity);
  router.post('/claim', controller.claim);
  router.get('/mine', controller.getMine);
  router.get('/technicians/search', controller.searchTechnicians);
  router.patch('/:id/technicians', controller.setTechnicians);
  router.patch('/:id/tasks/:taskId/reopen', controller.reopenTask);
  router.patch('/:id/confirm-complete', controller.confirmComplete);

  return router;
}

module.exports = buildRepairOrderRouter;
