const UserService = require('./UserService');
const ProductService = require('./ProductService');
const InventoryService = require('./InventoryService');
const { makeUserRepository } = require('../../infrastructure/repositories');
const { makeProductRepository } = require('../../infrastructure/repositories');
const { makeInventoryRepository } = require('../../infrastructure/repositories');

function makeUserService() {
  return new UserService({ userRepository: makeUserRepository() });
}

function makeProductService() {
  return new ProductService({ productRepository: makeProductRepository() });
}

function makeInventoryService() {
  return new InventoryService({ inventoryRepository: makeInventoryRepository() });
}

module.exports = {
  UserService,
  ProductService,
  InventoryService,
  makeUserService,
  makeProductService,
  makeInventoryService,
};
