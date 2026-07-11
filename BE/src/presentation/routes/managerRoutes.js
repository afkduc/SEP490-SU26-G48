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

  return router;
}

module.exports = buildManagerRouter;
