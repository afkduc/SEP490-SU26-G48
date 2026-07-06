const express = require('express');
const { success } = require('../../utils/response');
const buildUserRouter = require('./userRoutes');
const buildAuthRouter = require('./authRoutes');
const buildVehicleRouter = require('./vehicleRoutes');
const buildAdminRouter = require('./adminRoutes');

const router = express.Router();

router.get('/', (req, res) => {
  return success(res, null, 'Welcome to AutoGara API');
});

router.use('/auth', buildAuthRouter());
router.use('/users', buildUserRouter());
router.use('/vehicles', buildVehicleRouter());
router.use('/admin', buildAdminRouter());

module.exports = router;
