const { makeProductService } = require('../../application/services');
const { makeInventoryService } = require('../../application/services');

function makeProductController() {
  return new (require('./ProductController'))({ productService: makeProductService() });
}

function makeInventoryController() {
  return new (require('./InventoryController'))({ inventoryService: makeInventoryService() });
}

module.exports = { makeProductController, makeInventoryController };
