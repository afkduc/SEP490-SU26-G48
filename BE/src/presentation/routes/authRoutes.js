const express = require('express');
const AuthController = require('../controllers/AuthController');
const AuthService = require('../../application/services/AuthService');
const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
const { authenticate } = require('../../middlewares/auth');

function buildAuthRouter() {
  const router = express.Router();

  const repo = new AuthRepositoryImpl();
  const service = new AuthService(repo);
  const controller = new AuthController(service);

  router.post('/login', controller.login);
  router.get('/me', authenticate, controller.getMe);

  return router;
}

module.exports = buildAuthRouter;
