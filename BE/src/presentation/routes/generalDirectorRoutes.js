const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');
const GeneralDirectorController = require('../controllers/GeneralDirectorController');
const GeneralDirectorService = require('../../application/services/GeneralDirectorService');
const GeneralDirectorRepositoryImpl = require('../../infrastructure/repositories/GeneralDirectorRepositoryImpl');

function buildGeneralDirectorRouter() {
  const router = express.Router();
  const repository = new GeneralDirectorRepositoryImpl();
  const service = new GeneralDirectorService(repository);
  const controller = new GeneralDirectorController(service);

  router.use(authenticate, authorize('general_director', 'admin'), trackActivity);

  router.get('/reports/revenue', controller.getRevenueReports);
  router.get('/reports/settlements', controller.getSettlementReports);
  router.get('/reports/settlements/:id', controller.getSettlementReportById);

  // Reference data + personnel modules
  router.get('/branches', controller.getBranches);
  router.get('/employees', controller.getEmployees);
  router.get('/employees/:id', controller.getEmployeeById);

  // UC51 - technician coordination
  router.get('/technicians', controller.getTechnicians);
  router.get('/technicians/:id', controller.getTechnicianById);

  // UC52-55 - branch manager management
  router.get('/branch-managers', controller.getBranchManagers);
  router.get('/branch-managers/:id', controller.getBranchManagerById);
  router.post('/branch-managers', controller.createBranchManager);
  router.put('/branch-managers/:id', controller.updateBranchManager);
  router.patch('/branches/:id/deactivate', controller.deactivateBranch);
  router.patch('/branches/:id/reactivate', controller.reactivateBranch);

  return router;
}

module.exports = buildGeneralDirectorRouter;