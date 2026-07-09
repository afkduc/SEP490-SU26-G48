const UserService = require('./UserService');
const ProductService = require('./ProductService');
const RepairSettlementService = require('./RepairSettlementService');
const InventoryService = require('./InventoryService');
const {
  makeUserRepository,
  makeProductRepository,
  makeRepairSettlementRepository,
  makeInventoryRepository,
} = require('../../infrastructure/repositories');

function makeUserService() {
  return new UserService({ userRepository: makeUserRepository() });
}

function makeProductService() {
  return new ProductService({ productRepository: makeProductRepository() });
}

function makeRepairSettlementService() {
  return new RepairSettlementService({ repairSettlementRepository: makeRepairSettlementRepository() });
}

function makeInventoryService() {
  return new InventoryService({ inventoryRepository: makeInventoryRepository() });
}

module.exports = {
  UserService,
  ProductService,
  RepairSettlementService,
  InventoryService,
  makeUserService,
  makeProductService,
  makeRepairSettlementService,
  makeInventoryService,
};
