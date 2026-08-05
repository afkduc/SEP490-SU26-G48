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

  // occupy/release/heartbeat da bo han (khong con khai niem thiet bi giu
  // khoang nua). "mine" phuc vu to truong chon khoang cua minh khi gan viec
  // vua nhan (xem RepairOrderController.claim) - "branch-status" cho CVDV.
  router.use(authenticate, trackActivity);
  router.get('/mine', controller.listMine);
  router.get('/branch-status', controller.listByBranch);

  return router;
}

module.exports = buildVehicleBayRouter;
