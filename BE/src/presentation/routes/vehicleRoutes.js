const express = require('express');
const VehicleSearchController = require('../controllers/VehicleSearchController');
const VehicleSearchService = require('../../application/services/VehicleSearchService');
const VehicleSearchRepositoryImpl = require('../../infrastructure/repositories/VehicleSearchRepositoryImpl');
const VehicleOwnershipController = require('../controllers/VehicleOwnershipController');
const VehicleOwnershipService = require('../../application/services/VehicleOwnershipService');
const VehicleOwnershipRepositoryImpl = require('../../infrastructure/repositories/VehicleOwnershipRepositoryImpl');
const VehicleModelController = require('../controllers/VehicleModelController');
const VehicleModelRepository = require('../../infrastructure/repositories/VehicleModelRepository');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

function buildVehicleRouter() {
  const router = express.Router();

  const searchRepo = new VehicleSearchRepositoryImpl();
  const searchService = new VehicleSearchService(searchRepo);
  const searchController = new VehicleSearchController(searchService);

  const ownershipRepo = new VehicleOwnershipRepositoryImpl();
  const ownershipService = new VehicleOwnershipService({ vehicleOwnershipRepository: ownershipRepo });
  const ownershipController = new VehicleOwnershipController({ vehicleOwnershipService: ownershipService });

  const modelRepo = new VehicleModelRepository();
  const modelController = new VehicleModelController({ vehicleModelRepository: modelRepo });

  router.use(authenticate, trackActivity);
  router.get('/search', searchController.search);
  router.get('/models', modelController.search);
  router.post('/models', modelController.create);
  router.get('/:id/owners', ownershipController.getHistory);
  router.post('/:id/transfer', ownershipController.transfer);

  return router;
}

module.exports = buildVehicleRouter;
