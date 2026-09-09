const express = require('express');
const { makeRepairSettlementService } = require('../../application/services');
const RepairSettlementController = require('../controllers/RepairSettlementController');
const { authenticate, authorize } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

function makeRepairSettlementController() {
  return new RepairSettlementController({ repairSettlementService: makeRepairSettlementService() });
}

function buildRepairSettlementRouter() {
  const router = express.Router();
  const controller = makeRepairSettlementController();

  router.use(authenticate, trackActivity);

  // ─── Doc: KHONG gioi han vai tro ────────────────────────────────────────
  // To truong doc danh sach phieu o man "Khoang xe cua toi", man Lich su dich
  // vu cua khach cung doc - chan theo vai tro o day la hong 2 man do.
  router.get('/', controller.getAll);
  router.get('/check-duplicate', controller.checkDuplicate);
  // PHAI dat truoc '/:id' - khong thi Express khop "advisors" vao :id.
  router.get('/advisors', controller.getBranchAdvisors);
  router.get('/:id', controller.getById);
  router.get('/:id/activity-log', controller.getActivityLog);
  router.post('/:id/print-log', controller.logPrint);

  // ─── Ghi: chi 3 vai tro nay ─────────────────────────────────────────────
  // Truoc day ca router chi co authenticate, nen BAT KY tai khoan dang nhap
  // nao (to truong, tho, thu kho...) cung tao/sua duoc phieu quyet toan - va
  // nguoi tao TU DONG thanh co van dich vu cua phieu do (advisor_id =
  // req.user.userId, xem RepairSettlementService.create).
  //
  // Da tao ra du lieu sai that: phieu RO-2026-089 dang ghi to truong Tran Quoc
  // Bao lam co van dich vu.
  //
  // 3 vai tro nay lay dung theo chan cua FE (AppRoutes.jsx, route
  // /repair-settlement/* mo cho SERVICE_ADVISOR / MANAGER / ADMIN) - de FE va
  // BE khong lech nhau.
  const chiCoVan = authorize('service_advisor', 'manager', 'admin');
  router.post('/', chiCoVan, controller.create);
  router.put('/:id', chiCoVan, controller.update);
  router.patch('/:id/status', chiCoVan, controller.updateStatus);
  router.patch('/:id/tasks/:taskId/ng-decision', chiCoVan, controller.decideNgTask);
  router.post('/:id/lock', chiCoVan, controller.lock);
  router.delete('/:id/lock', chiCoVan, controller.unlock);
  router.post('/:id/payos/create-payment-link', chiCoVan, controller.createPaymentLink);

  return router;
}

module.exports = buildRepairSettlementRouter;
