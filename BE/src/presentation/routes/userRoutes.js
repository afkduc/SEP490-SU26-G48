const express = require('express');
const { makeUserController } = require('../controllers');

function buildUserRouter() {
  const router = express.Router();
  const controller = makeUserController();

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}

module.exports = buildUserRouter;
