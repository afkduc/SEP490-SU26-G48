const express = require('express');
const ImportRequestController = require('../controllers/ImportRequestController');
const { makeImportRequestService } = require('../../application/services');
const { authenticate } = require('../../middlewares/auth');
const { requirePerm } = require('../../middlewares/inventory/rbac');

function makeImportRequestController() {
  return new ImportRequestController({
    importRequestService: makeImportRequestService(),
  });
}

function buildImportRequestRouter() {
  const router = express.Router();
  const controller = makeImportRequestController();

  // Tat ca endpoint deu can authen.
  router.use(authenticate);

  // Sinh ma phieu tiep theo - phai goi truoc khi mo form tao.
  // Dat TRUOC /:id de khong bi nuot.
  router.get(
    '/meta/next-code',
    requirePerm('import_requests:read'),
    controller.getNextCode,
  );

  // List + detail
  router.get(
    '/',
    requirePerm('import_requests:read'),
    controller.list,
  );
  router.get(
    '/:id',
    requirePerm('import_requests:read'),
    controller.getById,
  );

  // Tao phieu (warehouse_staff, manager)
  router.post(
    '/',
    requirePerm('import_requests:create'),
    controller.create,
  );

  // Duyet / tu choi (manager)
  router.put(
    '/:id/approve',
    requirePerm('import_requests:approve'),
    controller.approve,
  );
  router.put(
    '/:id/reject',
    requirePerm('import_requests:approve'),
    controller.reject,
  );

  return router;
}

module.exports = buildImportRequestRouter;