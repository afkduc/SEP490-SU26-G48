const express = require('express');
const VehicleSearchController = require('../controllers/VehicleSearchController');
const VehicleSearchService = require('../../application/services/VehicleSearchService');
const VehicleSearchRepositoryImpl = require('../../infrastructure/repositories/VehicleSearchRepositoryImpl');
const VehicleOwnershipController = require('../controllers/VehicleOwnershipController');
const VehicleOwnershipService = require('../../application/services/VehicleOwnershipService');
const VehicleOwnershipRepositoryImpl = require('../../infrastructure/repositories/VehicleOwnershipRepositoryImpl');
const { authenticate } = require('../../middlewares/auth');

function buildVehicleRouter() {
  const router = express.Router();

  const searchRepo = new VehicleSearchRepositoryImpl();
  const searchService = new VehicleSearchService(searchRepo);
  const searchController = new VehicleSearchController(searchService);

  const ownershipRepo = new VehicleOwnershipRepositoryImpl();
  const ownershipService = new VehicleOwnershipService({ vehicleOwnershipRepository: ownershipRepo });
  const ownershipController = new VehicleOwnershipController({ vehicleOwnershipService: ownershipService });

  router.get('/search', authenticate, searchController.search);
  router.get('/:id/owners', authenticate, ownershipController.getHistory);
  router.post('/:id/transfer', authenticate, ownershipController.transfer);

  return router;
}

module.exports = buildVehicleRouter;
