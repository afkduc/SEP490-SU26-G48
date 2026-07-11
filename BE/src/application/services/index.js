const UserService = require('./UserService');
const ProductService = require('./ProductService');
const RepairSettlementService = require('./RepairSettlementService');
const RepairOrderService = require('./RepairOrderService');
const InventoryService = require('./InventoryService');
const {
  makeUserRepository,
  makeProductRepository,
  makeRepairSettlementRepository,
  makeRepairOrderRepository,
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

function makeRepairOrderService() {
  return new RepairOrderService({ repairOrderRepository: makeRepairOrderRepository() });
}

function makeInventoryService() {
  return new InventoryService({ inventoryRepository: makeInventoryRepository() });
}

module.exports = {
  UserService,
  ProductService,
  RepairSettlementService,
  RepairOrderService,
  InventoryService,
  makeUserService,
  makeProductService,
  makeRepairSettlementService,
  makeRepairOrderService,
  makeInventoryService,
};
