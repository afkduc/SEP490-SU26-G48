const express = require('express');
const ExportRequestController = require('../controllers/ExportRequestController');
const { makeExportRequestService } = require('../../application/services');
const { authenticate } = require('../../middlewares/auth');
const { requirePerm } = require('../../middlewares/inventory/rbac');

function makeExportRequestController() {
  return new ExportRequestController({
    exportRequestService: makeExportRequestService(),
  });
}

function buildExportRequestRouter() {
  const router = express.Router();
  const controller = makeExportRequestController();

  // Tat ca endpoint deu can authen.
  router.use(authenticate);

  // Sinh ma phieu tiep theo.
  // Dat TRUOC /:id de khong bi nuot.
  router.get(
    '/meta/next-code',
    requirePerm('export_requests:read'),
    controller.getNextCode,
  );

  // Service Order helpers - phai dat TRUOC /:id de khong bi nuot.
  router.get(
    '/service-orders/exportable',
    requirePerm('export_requests:create'),
    controller.listExportableServiceOrders,
  );
  router.get(
    '/service-orders/:id/for-export',
    requirePerm('export_requests:create'),
    controller.getServiceOrderForExport,
  );

  // List + detail phieu xuat.
  router.get(
    '/',
    requirePerm('export_requests:read'),
    controller.list,
  );
  router.get(
    '/:id',
    requirePerm('export_requests:read'),
    controller.getById,
  );

  // Tao phieu xuat (warehouse_staff, manager, admin).
  // NVKho tu xuat - khong can approve.
  router.post(
    '/',
    requirePerm('export_requests:create'),
    controller.create,
  );

  return router;
}

module.exports = buildExportRequestRouter;