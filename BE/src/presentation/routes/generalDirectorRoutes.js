const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const { requireScreen, requireScreenAction } = require('../../middlewares/permission');
const { trackActivity } = require('../../middlewares');
const GeneralDirectorController = require('../controllers/GeneralDirectorController');
const GeneralDirectorService = require('../../application/services/GeneralDirectorService');
const GeneralDirectorRepositoryImpl = require('../../infrastructure/repositories/GeneralDirectorRepositoryImpl');

/**
 * General Director routes — L1 (screen access) + L2 (feature bits).
 *
 * L1: requireScreen('director', resource) → screen:director:<resource>:access
 * L2: requireScreenAction('director:<resource>', action)
 *     → screen:director:<resource>:view|create|update|delete|export
 *
 * Vào được trang (L1) không đồng nghĩa có mọi nút — từng API nút check L2 riêng.
 */
function buildGeneralDirectorRouter() {
  const router = express.Router();
  const repository = new GeneralDirectorRepositoryImpl();
  const service = new GeneralDirectorService(repository);
  const controller = new GeneralDirectorController(service);

  router.use(authenticate, authorize('general_director', 'admin'), trackActivity);

  router.get(
    '/reports/revenue',
    requireScreen('director', 'reports'),
    requireScreenAction('director:reports', 'view'),
    controller.getRevenueReports
  );
  router.get(
    '/reports/settlements',
    requireScreen('director', 'settlements'),
    requireScreenAction('director:settlements', 'view'),
    controller.getSettlementReports
  );
  router.get(
    '/reports/settlements/:id',
    requireScreen('director', 'settlements'),
    requireScreenAction('director:settlements', 'view'),
    controller.getSettlementReportById
  );

  router.get(
    '/branches',
    requireScreen('director', 'branches'),
    requireScreenAction('director:branches', 'view'),
    controller.getBranches
  );
  router.get(
    '/employees',
    requireScreen('director', 'employees'),
    requireScreenAction('director:employees', 'view'),
    controller.getEmployees
  );
  router.get(
    '/employees/:id',
    requireScreen('director', 'employees'),
    requireScreenAction('director:employees', 'view'),
    controller.getEmployeeById
  );

  router.get(
    '/technicians',
    requireScreen('director', 'technicians'),
    requireScreenAction('director:technicians', 'view'),
    controller.getTechnicians
  );
  router.get(
    '/technicians/:id',
    requireScreen('director', 'technicians'),
    requireScreenAction('director:technicians', 'view'),
    controller.getTechnicianById
  );

  router.get(
    '/branch-managers',
    requireScreen('director', 'branch_managers'),
    requireScreenAction('director:branch_managers', 'view'),
    controller.getBranchManagers
  );
  router.get(
    '/branch-managers/:id',
    requireScreen('director', 'branch_managers'),
    requireScreenAction('director:branch_managers', 'view'),
    controller.getBranchManagerById
  );
  router.post(
    '/branch-managers',
    requireScreen('director', 'branch_managers'),
    requireScreenAction('director:branch_managers', 'create'),
    controller.createBranchManager
  );
  router.put(
    '/branch-managers/:id',
    requireScreen('director', 'branch_managers'),
    requireScreenAction('director:branch_managers', 'update'),
    controller.updateBranchManager
  );
  router.patch(
    '/branches/:id/deactivate',
    requireScreen('director', 'branches'),
    requireScreenAction('director:branches', 'delete'),
    controller.deactivateBranch
  );
  router.patch(
    '/branches/:id/reactivate',
    requireScreen('director', 'branches'),
    requireScreenAction('director:branches', 'update'),
    controller.reactivateBranch
  );

  return router;
}

module.exports = buildGeneralDirectorRouter;
