const express = require('express');
const { makeDashboardService } = require('../../application/services');
const DashboardController = require('../controllers/DashboardController');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

function makeDashboardController() {
  return new DashboardController({ dashboardService: makeDashboardService() });
}

function buildDashboardRouter() {
  const router = express.Router();
  const controller = makeDashboardController();

  router.use(authenticate, trackActivity);
  router.get('/overview', controller.getOverview);

  return router;
}

module.exports = buildDashboardRouter;
