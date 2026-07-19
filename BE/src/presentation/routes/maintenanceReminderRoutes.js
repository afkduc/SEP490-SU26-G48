const express = require('express');
const { makeMaintenanceReminderService } = require('../../application/services');
const MaintenanceReminderController = require('../controllers/MaintenanceReminderController');
const { authenticate } = require('../../middlewares/auth');

function makeMaintenanceReminderController() {
  return new MaintenanceReminderController({ maintenanceReminderService: makeMaintenanceReminderService() });
}

function buildMaintenanceReminderRouter() {
  const router = express.Router();
  const controller = makeMaintenanceReminderController();

  router.use(authenticate);
  router.get('/', controller.getAll);
  router.patch('/:id/sent', controller.markSent);
  router.patch('/:id/confirmed', controller.markConfirmed);

  return router;
}

module.exports = buildMaintenanceReminderRouter;
