const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const GeneralDirectorController = require('../controllers/GeneralDirectorController');
const GeneralDirectorService = require('../../application/services/GeneralDirectorService');
const GeneralDirectorRepositoryImpl = require('../../infrastructure/repositories/GeneralDirectorRepositoryImpl');

function buildGeneralDirectorRouter() {
  const router = express.Router();
  const repository = new GeneralDirectorRepositoryImpl();
  const service = new GeneralDirectorService(repository);
  const controller = new GeneralDirectorController(service);

  router.use(authenticate, authorize('general_director', 'admin'));

  router.get('/reports/revenue', controller.getRevenueReports);
  router.get('/reports/settlements', controller.getSettlementReports);
  router.get('/reports/settlements/:id', controller.getSettlementReportById);
  router.get('/branches', controller.getBranches);
  router.get('/employees', controller.getEmployees);
  router.get('/employees/:id', controller.getEmployeeById);
  router.get('/technicians', controller.getTechnicians);
  router.get('/technicians/:id', controller.getTechnicianById);

  return router;
}

module.exports = buildGeneralDirectorRouter;