const express = require('express');
const SupplierController = require('../controllers/SupplierController');
const SupplierService = require('../../application/services/SupplierService');
const { makeSupplierRepository } = require('../../infrastructure/repositories');

function makeSupplierController() {
  return new SupplierController({
    supplierService: new SupplierService({ supplierRepository: makeSupplierRepository() }),
  });
}

function buildSupplierRouter() {
  const router = express.Router();
  const controller = makeSupplierController();

  // Read-only: chi list va xem chi tiet.
  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);

  return router;
}

module.exports = buildSupplierRouter;