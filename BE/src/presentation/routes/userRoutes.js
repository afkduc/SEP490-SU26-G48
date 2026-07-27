const express = require('express');
const { makeUserController } = require('../controllers');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { trackActivity } = require('../../middlewares');

function buildUserRouter() {
  const router = express.Router();
  const controller = makeUserController();

  router.use(authenticate, requireAdmin, trackActivity);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}

module.exports = buildUserRouter;
