const express = require('express');
const ExportRequestController = require('../controllers/ExportRequestController');
const { makeExportRequestService } = require('../../application/services');
const { authenticate } = require('../../middlewares/auth');
const { requirePerm } = require('../../middlewares');

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

  // Danh sach tho may cho dropdown "Nguoi lay" - phai dat TRUOC /:id.
  router.get(
    '/technicians',
    requirePerm('export_requests:create'),
    controller.listTechnicians,
  );

  // Repair Order helpers - phai dat TRUOC /:id de khong bi nuot.
  router.get(
    '/repair-orders/exportable',
    requirePerm('export_requests:create'),
    controller.listExportableRepairOrders,
  );
  router.get(
    '/repair-orders/:id/for-export',
    requirePerm('export_requests:create'),
    controller.getRepairOrderForExport,
  );

  // List + detail phieu xuat.
  router.get(
    '/',
    requirePerm('export_requests:read'),
    controller.list,
  );
  router.get(
    '/:id/pickups',
    requirePerm('export_requests:read'),
    controller.getPickups,
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