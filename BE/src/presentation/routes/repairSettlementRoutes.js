const express = require('express');
const { makeRepairSettlementService } = require('../../application/services');
const RepairSettlementController = require('../controllers/RepairSettlementController');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

function makeRepairSettlementController() {
  return new RepairSettlementController({ repairSettlementService: makeRepairSettlementService() });
}

function buildRepairSettlementRouter() {
  const router = express.Router();
  const controller = makeRepairSettlementController();

  router.use(authenticate, trackActivity);
  router.get('/', controller.getAll);
  router.get('/check-duplicate', controller.checkDuplicate);
  // PHAI dat truoc '/:id' - khong thi Express khop "advisors" vao :id.
  router.get('/advisors', controller.getBranchAdvisors);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.patch('/:id/status', controller.updateStatus);
  router.post('/:id/print-log', controller.logPrint);
  router.patch('/:id/tasks/:taskId/ng-decision', controller.decideNgTask);
  router.post('/:id/lock', controller.lock);
  router.delete('/:id/lock', controller.unlock);
  router.get('/:id/activity-log', controller.getActivityLog);
  router.post('/:id/payos/create-payment-link', controller.createPaymentLink);

  return router;
}

module.exports = buildRepairSettlementRouter;
