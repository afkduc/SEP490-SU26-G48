const express = require('express');
const SupplierController = require('../controllers/SupplierController');
const SupplierService = require('../../application/services/SupplierService');
const { makeSupplierRepository } = require('../../infrastructure/repositories');
const { authenticate } = require('../../middlewares/auth');

function makeSupplierController() {
  return new SupplierController({
    supplierService: new SupplierService({ supplierRepository: makeSupplierRepository() }),
  });
}

function buildSupplierRouter() {
  const router = express.Router();
  const controller = makeSupplierController();

  // Tat ca endpoint deu can authen (truoc day thieu -> lo hong).
  router.use(authenticate);

  // Read-only: chi list va xem chi tiet.
  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);

  return router;
}

module.exports = buildSupplierRouter;