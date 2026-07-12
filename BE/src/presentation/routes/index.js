const express = require('express');
const { success } = require('../../utils/response');
const buildUserRouter = require('./userRoutes');
const buildAuthRouter = require('./authRoutes');
const buildVehicleRouter = require('./vehicleRoutes');
const buildAdminRouter = require('./adminRoutes');
const buildProductRouter = require('./productRoutes');
const buildInventoryRouter = require('./inventoryRoutes');
const buildSupplierRouter = require('./supplierRoutes');
const buildCatalogRouter = require('./catalogRoutes');
const buildRepairSettlementRouter = require('./repairSettlementRoutes');
const buildRepairOrderRouter = require('./repairOrderRoutes');
const buildGeneralDirectorRouter = require('./generalDirectorRoutes');
const buildManagerRouter = require('./managerRoutes');
const buildAuditRouter = require('./auditRoutes');

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
router.use('/suppliers', buildSupplierRouter());
router.use('/catalog', buildCatalogRouter());
router.use('/repair-settlements', buildRepairSettlementRouter());
router.use('/repair-orders', buildRepairOrderRouter());
router.use('/general-director', buildGeneralDirectorRouter());
router.use('/manager', buildManagerRouter());
router.use('/audit', buildAuditRouter());

module.exports = router;
