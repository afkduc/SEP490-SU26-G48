const express = require('express');
const rateLimit = require('express-rate-limit');
const { makeRepairOrderService, makeServiceRequestService, makeRepairSettlementService } = require('../../application/services');
const VehicleBayRepositoryImpl = require('../../infrastructure/repositories/VehicleBayRepositoryImpl');
const RepairOrderController = require('../controllers/RepairOrderController');
const ServiceRequestController = require('../controllers/ServiceRequestController');
const RepairSettlementController = require('../controllers/RepairSettlementController');
const PublicBayBoardController = require('../controllers/PublicBayBoardController');

function makeRepairOrderController() {
  return new RepairOrderController({ repairOrderService: makeRepairOrderService() });
}

function makeServiceRequestController() {
  return new ServiceRequestController({ serviceRequestService: makeServiceRequestService() });
}

function makeRepairSettlementController() {
  return new RepairSettlementController({ repairSettlementService: makeRepairSettlementService() });
}

function makeBayBoardController() {
  return new PublicBayBoardController({
    vehicleBayRepository: new VehicleBayRepositoryImpl(),
    repairOrderService: makeRepairOrderService(),
  });
}

// Endpoint nay khong yeu cau dang nhap (khach vang lai tra cuu tu landing
// page) nen can rate limit rieng de chan do ma sua chua hang loat - 20
// request/phut/IP la du cho nguoi dung that thu vai lan, van chan duoc bot.
const lookupRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
    errors: null,
  },
});

// Rate limit rieng cho form "Lien he" - nhe hon lookup vi day la hanh dong
// khach chi lam 1 lan, chu yeu de chan bot spam gui form hang loat.
const serviceRequestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
    errors: null,
  },
});

// Man hinh bao ve tai cong / khoang xe - 1 thiet bi co dinh, poll/xac nhan
// lien tuc ca ngay nen can han muc rong hon lookup thong thuong. Dung chung
// cho ca 2 man (khong lien quan gi nhau ve nghiep vu, chi giong nhau ve
// "thiet bi co dinh, khong dang nhap").
const gateRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
    errors: null,
  },
});

function buildPublicRouter() {
  const router = express.Router();
  const controller = makeRepairOrderController();
  const serviceRequestController = makeServiceRequestController();
  const repairSettlementController = makeRepairSettlementController();
  const bayBoardController = makeBayBoardController();

  router.get('/lookup/:code', lookupRateLimiter, controller.lookupPublicProgress);
  router.get('/vehicle-history/:identifier', lookupRateLimiter, repairSettlementController.lookupPublicHistory);
  router.get('/branches', serviceRequestController.getPublicBranches);
  router.get('/service-packages', serviceRequestController.getPublicServicePackages);
  router.get('/service-packages/:code', serviceRequestController.getPublicServicePackageByCode);
  router.post('/service-requests', serviceRequestRateLimiter, serviceRequestController.createPublic);
  router.get('/gate/pending', gateRateLimiter, repairSettlementController.getGatePending);
  router.post('/gate/:id/confirm-exit', gateRateLimiter, repairSettlementController.confirmGateExit);

  // Man khoang xe cong khai (khong dang nhap) - "/bay/<chi nhanh>/<so
  // khoang>" tren Landing, xem PublicBayBoardController.js. Chi con "lam
  // viec tai khoang" (xem/tick/hoan thanh) - "nhan viec" va "lich su" da
  // chuyen ve tai khoan cua chinh to truong (xem repairOrderRoutes.js, authenticated).
  router.get('/bays', gateRateLimiter, bayBoardController.listBays);
  router.get('/bays/:bayId/active-order', gateRateLimiter, bayBoardController.getActiveOrder);
  router.patch('/repair-orders/:id/tasks/:taskId', gateRateLimiter, bayBoardController.updateTaskStatus);

  return router;
}

module.exports = buildPublicRouter;
