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
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.patch('/:id/status', controller.updateStatus);

  return router;
}

module.exports = buildRepairSettlementRouter;
