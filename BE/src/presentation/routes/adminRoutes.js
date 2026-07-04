const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticate, requireAdmin } = require('../../middlewares/auth');

function buildAdminRouter() {
  const router = express.Router();
  const controller = new AdminController();

  router.use(authenticate, requireAdmin);

  router.get('/dashboard', controller.getDashboardStats);
  router.get('/users', controller.listUsers);

  return router;
}

module.exports = buildAdminRouter;