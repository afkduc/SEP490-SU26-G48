const express = require('express');
const { makeRepairOrderService } = require('../../application/services');
const RepairOrderController = require('../controllers/RepairOrderController');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

function makeRepairOrderController() {
  return new RepairOrderController({ repairOrderService: makeRepairOrderService() });
}

function buildRepairOrderRouter() {
  const router = express.Router();
  const controller = makeRepairOrderController();

  router.use(authenticate, trackActivity);
  router.get('/', controller.getAll);
  router.get('/team-leaders', controller.getTeamLeaders);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.patch('/:id/status', controller.updateStatus);
  router.patch('/:id/tasks/:taskId', controller.updateTaskStatus);

  return router;
}

module.exports = buildRepairOrderRouter;
