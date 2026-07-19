const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const ManagerController = require('../controllers/ManagerController');
const ManagerService = require('../../application/services/ManagerService');
const ManagerRepositoryImpl = require('../../infrastructure/repositories/ManagerRepositoryImpl');
const ManagerImportRequestController = require('../controllers/ManagerImportRequestController');
const ManagerExportRequestController = require('../controllers/ManagerExportRequestController');
const { makeImportRequestService, makeExportRequestService } = require('../../application/services');
const { requirePerm } = require('../../middlewares/inventory/rbac');

function buildManagerRouter() {
  const router = express.Router();
  const repository = new ManagerRepositoryImpl();
  const service = new ManagerService(repository);
  const controller = new ManagerController(service);

  // Controller rieng cho phieu nhap (manager vao day de duyet/tu choi).
  const importRequestController = new ManagerImportRequestController({
    importRequestService: makeImportRequestService(),
  });

  // Controller rieng cho phieu xuat (manager vao day de xem/audit - NVKho tu xuat).
  const exportRequestController = new ManagerExportRequestController({
    exportRequestService: makeExportRequestService(),
  });

  router.use(authenticate, authorize('manager', 'admin'));

  router.get('/branch', controller.getBranch);
  router.get('/roles', controller.getRoles);

  router.get('/employees', controller.getEmployees);
  router.get('/employees/:id', controller.getEmployeeById);
  router.post('/employees', controller.createEmployee);
  router.put('/employees/:id', controller.updateEmployee);

  router.get('/service-categories', controller.getServiceCategories);
  router.get('/products', controller.getProducts);

  router.get('/services', controller.getServices);
  router.get('/services/:id', controller.getServiceById);
  router.post('/services', controller.createService);
  router.put('/services/:id', controller.updateService);

  router.get('/service-packages', controller.getServicePackages);
  router.get('/service-packages/:id', controller.getServicePackageById);
  router.post('/service-packages', controller.createServicePackage);
  router.put('/service-packages/:id', controller.updateServicePackage);

  router.get('/settlements', controller.getSettlementReports);
  router.get('/settlements/:id', controller.getSettlementReportById);

  router.get('/specialties', controller.getSpecialties);
  router.get('/team-leaders/options', controller.getTeamLeaderOptions);

  router.get('/technicians', controller.getTechnicians);
  router.get('/technicians/:id', controller.getTechnicianById);
  router.post('/technicians', controller.createTechnician);
  router.put('/technicians/:id', controller.updateTechnician);

  router.get('/team-leaders', controller.getTeamLeaders);
  router.get('/team-leaders/:id', controller.getTeamLeaderById);
  router.post('/team-leaders', controller.createTeamLeader);
  router.put('/team-leaders/:id', controller.updateTeamLeader);

  // ===== Phieu nhap kho (Manager) =====
  // Manager truy cap /manager/import-requests ... de xem va duyet phieu
  // cua chi nhanh minh quan ly.
  // Quyen truy cap thong qua permission trong bang role_permissions:
  //   - import_requests:read    (xem danh sach + chi tiet)
  //   - import_requests:approve (duyet / tu choi)
  router.get(
    '/import-requests',
    requirePerm('import_requests:read'),
    importRequestController.list,
  );
  router.get(
    '/import-requests/:id',
    requirePerm('import_requests:read'),
    importRequestController.getById,
  );
  router.put(
    '/import-requests/:id/approve',
    requirePerm('import_requests:approve'),
    importRequestController.approve,
  );
  router.put(
    '/import-requests/:id/reject',
    requirePerm('import_requests:approve'),
    importRequestController.reject,
  );

  // ===== Phieu xuat kho (Manager) =====
  // Manager truy cap /manager/export-requests ... de xem lich su xuat kho (read-only).
  // NVKho tu xuat truc tiep - khong can Manager duyet.
  router.get(
    '/export-requests',
    requirePerm('export_requests:read'),
    exportRequestController.list,
  );
  router.get(
    '/export-requests/:id',
    requirePerm('export_requests:read'),
    exportRequestController.getById,
  );

  return router;
}

module.exports = buildManagerRouter;
