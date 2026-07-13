const express = require('express');
const AuthController = require('../controllers/AuthController');
const AuthService = require('../../application/services/AuthService');
const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
const { authenticate } = require('../../middlewares/auth');
const { trackLogout } = require('../../middlewares/loginSessionMiddleware');

function buildAuthRouter() {
  const router = express.Router();

  const repo = new AuthRepositoryImpl();
  const service = new AuthService(repo);
  const controller = new AuthController(service);

  router.post('/login', controller.login);
  router.get('/me', authenticate, controller.getMe);
  router.post('/logout', authenticate, async (req, res, next) => {
    await trackLogout(req);
    return res.status(200).json({ message: 'Đăng xuất thành công' });
  });

  return router;
}

module.exports = buildAuthRouter;
