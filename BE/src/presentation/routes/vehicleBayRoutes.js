const express = require('express');
const VehicleBayController = require('../controllers/VehicleBayController');
const VehicleBayService = require('../../application/services/VehicleBayService');
const VehicleBayRepositoryImpl = require('../../infrastructure/repositories/VehicleBayRepositoryImpl');
const { authenticate } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

function buildVehicleBayRouter() {
  const router = express.Router();
  const controller = new VehicleBayController({
    vehicleBayService: new VehicleBayService({ vehicleBayRepository: new VehicleBayRepositoryImpl() }),
  });

  router.use(authenticate, trackActivity);
  router.get('/mine', controller.listMine);
  router.get('/branch-status', controller.listByBranch);
  router.post('/:id/occupy', controller.occupy);
  router.post('/:id/release', controller.release);
  router.post('/:id/heartbeat', controller.heartbeat);

  return router;
}

module.exports = buildVehicleBayRouter;
