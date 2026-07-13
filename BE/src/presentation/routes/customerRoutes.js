const express = require('express');
const { makeCustomerService } = require('../../application/services');
const CustomerController = require('../controllers/CustomerController');
const { authenticate } = require('../../middlewares/auth');

function makeCustomerController() {
  return new CustomerController({ customerService: makeCustomerService() });
}

function buildCustomerRouter() {
  const router = express.Router();
  const controller = makeCustomerController();

  router.use(authenticate);
  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);

  return router;
}

module.exports = buildCustomerRouter;
