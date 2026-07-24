const express = require('express');
const rateLimit = require('express-rate-limit');
const { makeRepairOrderService, makeServiceRequestService } = require('../../application/services');
const RepairOrderController = require('../controllers/RepairOrderController');
const ServiceRequestController = require('../controllers/ServiceRequestController');

function makeRepairOrderController() {
  return new RepairOrderController({ repairOrderService: makeRepairOrderService() });
}

function makeServiceRequestController() {
  return new ServiceRequestController({ serviceRequestService: makeServiceRequestService() });
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

function buildPublicRouter() {
  const router = express.Router();
  const controller = makeRepairOrderController();
  const serviceRequestController = makeServiceRequestController();

  router.get('/lookup/:code', lookupRateLimiter, controller.lookupPublicProgress);
  router.get('/branches', serviceRequestController.getPublicBranches);
  router.get('/vehicle-brands', serviceRequestController.getPublicVehicleBrands);
  router.post('/service-requests', serviceRequestRateLimiter, serviceRequestController.createPublic);

  return router;
}

module.exports = buildPublicRouter;
