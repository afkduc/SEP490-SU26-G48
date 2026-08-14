const express = require('express');
const { success } = require('../../utils/response');
const buildAuthRouter = require('./authRoutes');
const buildVehicleRouter = require('./vehicleRoutes');
const buildAdminRouter = require('./adminRoutes');
const buildProductRouter = require('./productRoutes');
const buildInventoryRouter = require('./inventoryRoutes');
const buildSupplierRouter = require('./supplierRoutes');
const buildCatalogRouter = require('./catalogRoutes');
const buildRepairSettlementRouter = require('./repairSettlementRoutes');
const buildRepairOrderRouter = require('./repairOrderRoutes');
const buildVehicleBayRouter = require('./vehicleBayRoutes');
const buildGeneralDirectorRouter = require('./generalDirectorRoutes');
const buildManagerRouter = require('./managerRoutes');
const buildCustomerRouter = require('./customerRoutes');
const buildAuditRouter = require('./auditRoutes');
const buildImportRequestRouter = require('./importRequestRoutes');
const buildExportRequestRouter = require('./exportRequestRoutes');
const buildProfileRouter = require('./profileRoutes');
const buildDashboardRouter = require('./dashboardRoutes');
const buildMaintenanceReminderRouter = require('./maintenanceReminderRoutes');
const buildSSERouter = require('./sseRoutes');
const buildPublicRouter = require('./publicRoutes');
const buildServiceRequestRouter = require('./serviceRequestRoutes');
const buildPayosWebhookRouter = require('./payosWebhookRoutes');

const router = express.Router();

router.get('/', (req, res) => {
  return success(res, null, 'Welcome to AutoGara API');
});

// Route debug (chỉ trả IP của request hiện tại) — dùng để kiểm tra
// Express đang lấy IP đúng chưa sau khi deploy qua reverse proxy / CDN.
// Mở browser/postman: GET /api/_debug/whoami → trả IP Express thấy được.
router.get('/_debug/whoami', (req, res) => {
  return success(res, {
    ip: req.ip,
    ips: req.ips,
    socketRemote: req.socket ? req.socket.remoteAddress : null,
    xForwardedFor: req.headers['x-forwarded-for'] || null,
    xRealIp: req.headers['x-real-ip'] || null,
    trustProxySetting: req.app.get('trust proxy'),
  }, 'IP mà Express đang nhìn thấy từ request này');
});

router.use('/auth', buildAuthRouter());
router.use('/vehicles', buildVehicleRouter());
router.use('/admin', buildAdminRouter());
router.use('/products', buildProductRouter());
router.use('/inventory', buildInventoryRouter());
router.use('/suppliers', buildSupplierRouter());
router.use('/catalog', buildCatalogRouter());
router.use('/repair-settlements', buildRepairSettlementRouter());
router.use('/repair-orders', buildRepairOrderRouter());
router.use('/vehicle-bays', buildVehicleBayRouter());
router.use('/general-director', buildGeneralDirectorRouter());
router.use('/manager', buildManagerRouter());
router.use('/customers', buildCustomerRouter());
router.use('/audit', buildAuditRouter());
router.use('/import-requests', buildImportRequestRouter());
router.use('/export-requests', buildExportRequestRouter());
router.use('/profile', buildProfileRouter());
router.use('/dashboard', buildDashboardRouter());
router.use('/maintenance-reminders', buildMaintenanceReminderRouter());
router.use('/service-requests', buildServiceRequestRouter());
router.use('/sse', buildSSERouter());
// Public - khong qua authenticate, dung cho landing page (tra cuu tien do
// sua chua bang ma, man bao ve, man khoang xe... deu khong can dang nhap).
router.use('/public', buildPublicRouter());
// PayOS webhook - khong qua authenticate (xem ghi chu trong payosWebhookRoutes.js).
router.use('/payos', buildPayosWebhookRouter());

module.exports = router;
