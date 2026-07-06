const express = require('express');
const VehicleSearchController = require('../controllers/VehicleSearchController');
const VehicleSearchService = require('../../application/services/VehicleSearchService');
const VehicleSearchRepositoryImpl = require('../../infrastructure/repositories/VehicleSearchRepositoryImpl');
const { authenticate } = require('../../middlewares/auth');

function buildVehicleRouter() {
  const router = express.Router();

  const repo = new VehicleSearchRepositoryImpl();
  const service = new VehicleSearchService(repo);
  const controller = new VehicleSearchController(service);

  router.get('/search', authenticate, controller.search);

  return router;
}

module.exports = buildVehicleRouter;
