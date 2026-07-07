const { makeUserService } = require('../../application/services');
const { makeProductService } = require('../../application/services');

function makeUserController() {
  return new (require('./UserController'))({ userService: makeUserService() });
}

function makeProductController() {
  return new (require('./ProductController'))({ productService: makeProductService() });
}

module.exports = { makeUserController, makeProductController };
