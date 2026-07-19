const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');
const ManagerController = require('../controllers/ManagerController');
const ManagerService = require('../../application/services/ManagerService');
const ManagerRepositoryImpl = require('../../infrastructure/repositories/ManagerRepositoryImpl');

function buildManagerRouter() {
  const router = express.Router();
  const repository = new ManagerRepositoryImpl();
  const service = new ManagerService(repository);
  const controller = new ManagerController(service);
  const importRequestController = new ManagerImportRequestController({
    importRequestService: makeImportRequestService(),
  });
  const exportRequestController = new ManagerExportRequestController({
    exportRequestService: makeExportRequestService(),
  });

  router.use(authenticate, authorize('manager', 'admin'), trackActivity);

  router.get('/branch', controller.getBranch);
  router.get('/roles', controller.getRoles);

  router.get('/employees', controller.getEmployees);
  router.get('/employees/:id', controller.getEmployeeById);
  router.post('/employees', controller.createEmployee);
  router.put('/employees/:id', controller.updateEmployee);

  router.get('/service-categories', controller.getServiceCategories);

  router.get('/services', controller.getServices);
  router.get('/services/:id', controller.getServiceById);
  router.post('/services', controller.createService);
  router.put('/services/:id', controller.updateService);

  router.get('/service-packages', controller.getServicePackages);
  router.get('/service-packages/:id', controller.getServicePackageById);
  router.post('/service-packages', controller.createServicePackage);
  router.put('/service-packages/:id', controller.updateServicePackage);

  router.get('/settlements', controller.getSettlementReports);
  router.get('/settlements/:id', controller.getSettlementReportById);

  router.get('/specialties', controller.getSpecialties);
  router.get('/team-leaders/options', controller.getTeamLeaderOptions);

  router.get('/technicians', controller.getTechnicians);
  router.get('/technicians/:id', controller.getTechnicianById);
  router.post('/technicians', controller.createTechnician);
  router.put('/technicians/:id', controller.updateTechnician);

  router.get('/team-leaders', controller.getTeamLeaders);
  router.get('/team-leaders/:id', controller.getTeamLeaderById);
  router.post('/team-leaders', controller.createTeamLeader);
  router.put('/team-leaders/:id', controller.updateTeamLeader);

  return router;
}

module.exports = buildManagerRouter;
