const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const { requireScreen } = require('../../middlewares/permission');
const { trackActivity } = require('../../middlewares');
const GeneralDirectorController = require('../controllers/GeneralDirectorController');
const GeneralDirectorService = require('../../application/services/GeneralDirectorService');
const GeneralDirectorRepositoryImpl = require('../../infrastructure/repositories/GeneralDirectorRepositoryImpl');

function buildGeneralDirectorRouter() {
  const router = express.Router();
  const repository = new GeneralDirectorRepositoryImpl();
  const service = new GeneralDirectorService(repository);
  const controller = new GeneralDirectorController(service);

  router.use(authenticate, authorize('general_director', 'admin'), trackActivity);

  router.get(
    '/reports/revenue',
    requireScreen('general_director', 'reports'),
    controller.getRevenueReports
  );
  router.get(
    '/reports/settlements',
    requireScreen('general_director', 'settlements'),
    controller.getSettlementReports
  );
  router.get(
    '/reports/settlements/:id',
    requireScreen('general_director', 'settlements'),
    controller.getSettlementReportById
  );

  // Reference data + personnel modules
  router.get('/branches', controller.getBranches);
  router.get(
    '/employees',
    requireScreen('general_director', 'employees'),
    controller.getEmployees
  );
  router.get(
    '/employees/:id',
    requireScreen('general_director', 'employees'),
    controller.getEmployeeById
  );

  // UC51 - technician coordination
  // Permission rieng cho technicians (khong chia se voi employees)
  router.get(
    '/technicians',
    requireScreen('general_director', 'technicians'),
    controller.getTechnicians
  );
  router.get(
    '/technicians/:id',
    requireScreen('general_director', 'technicians'),
    controller.getTechnicianById
  );

  // UC52-55 - branch manager management
  router.get(
    '/branch-managers',
    requireScreen('general_director', 'branch_managers'),
    controller.getBranchManagers
  );
  router.get(
    '/branch-managers/:id',
    requireScreen('general_director', 'branch_managers'),
    controller.getBranchManagerById
  );
  router.post(
    '/branch-managers',
    requireScreen('general_director', 'branch_managers'),
    controller.createBranchManager
  );
  router.put(
    '/branch-managers/:id',
    requireScreen('general_director', 'branch_managers'),
    controller.updateBranchManager
  );
  router.patch(
    '/branches/:id/deactivate',
    requireScreen('general_director', 'branches'),
    controller.deactivateBranch
  );
  router.patch(
    '/branches/:id/reactivate',
    requireScreen('general_director', 'branches'),
    controller.reactivateBranch
  );

  return router;
}

module.exports = buildGeneralDirectorRouter;