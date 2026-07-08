const { makeUserService } = require('../../application/services');
const { makeProductService } = require('../../application/services');
const { makeInventoryService } = require('../../application/services');

function makeUserController() {
  return new (require('./UserController'))({ userService: makeUserService() });
}

function makeProductController() {
  return new (require('./ProductController'))({ productService: makeProductService() });
}

function makeInventoryController() {
  return new (require('./InventoryController'))({ inventoryService: makeInventoryService() });
}

module.exports = { makeUserController, makeProductController, makeInventoryController };
