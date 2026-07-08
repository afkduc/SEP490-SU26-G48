const express = require('express');
const { success } = require('../../utils/response');
const buildUserRouter = require('./userRoutes');
const buildAuthRouter = require('./authRoutes');
const buildVehicleRouter = require('./vehicleRoutes');
const buildAdminRouter = require('./adminRoutes');
const buildProductRouter = require('./productRoutes');
const buildInventoryRouter = require('./inventoryRoutes');

const router = express.Router();

router.get('/', (req, res) => {
  return success(res, null, 'Welcome to AutoGara API');
});

router.use('/auth', buildAuthRouter());
router.use('/users', buildUserRouter());
router.use('/vehicles', buildVehicleRouter());
router.use('/admin', buildAdminRouter());
router.use('/products', buildProductRouter());
router.use('/inventory', buildInventoryRouter());

module.exports = router;
