const UserService = require('./UserService');
const ProductService = require('./ProductService');
const RepairSettlementService = require('./RepairSettlementService');
const RepairOrderService = require('./RepairOrderService');
const InventoryService = require('./InventoryService');
const CustomerService = require('./CustomerService');
const {
  makeUserRepository,
  makeProductRepository,
  makeRepairSettlementRepository,
  makeRepairOrderRepository,
  makeInventoryRepository,
  makeCustomerRepository,
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

function makeCustomerService() {
  return new CustomerService({ customerRepository: makeCustomerRepository() });
}

module.exports = {
  UserService,
  ProductService,
  RepairSettlementService,
  RepairOrderService,
  InventoryService,
  CustomerService,
  makeUserService,
  makeProductService,
  makeRepairSettlementService,
  makeRepairOrderService,
  makeInventoryService,
  makeCustomerService,
};
