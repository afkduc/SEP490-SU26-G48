const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const ManagerController = require('../controllers/ManagerController');
const ManagerService = require('../../application/services/ManagerService');
const ManagerRepositoryImpl = require('../../infrastructure/repositories/ManagerRepositoryImpl');

function buildManagerRouter() {
  const router = express.Router();
  const repository = new ManagerRepositoryImpl();
  const service = new ManagerService(repository);
  const controller = new ManagerController(service);

  router.use(authenticate, authorize('manager', 'admin'));

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

  return router;
}

module.exports = buildManagerRouter;
