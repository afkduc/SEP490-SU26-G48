const UserRepositoryImpl = require('./UserRepositoryImpl');
const ProductRepositoryImpl = require('./ProductRepositoryImpl');
const RepairSettlementRepositoryImpl = require('./RepairSettlementRepositoryImpl');
const RepairOrderRepositoryImpl = require('./RepairOrderRepositoryImpl');
const InventoryRepositoryImpl = require('./InventoryRepositoryImpl');
const CustomerRepositoryImpl = require('./CustomerRepositoryImpl');

function makeUserRepository() {
  return new UserRepositoryImpl();
}

function makeProductRepository() {
  return new ProductRepositoryImpl();
}

function makeRepairSettlementRepository() {
  return new RepairSettlementRepositoryImpl();
}

function makeRepairOrderRepository() {
  return new RepairOrderRepositoryImpl();
}

function makeInventoryRepository() {
  return new InventoryRepositoryImpl();
}

function makeCustomerRepository() {
  return new CustomerRepositoryImpl();
}

module.exports = {
  makeUserRepository,
  makeProductRepository,
  makeRepairSettlementRepository,
  makeRepairOrderRepository,
  makeInventoryRepository,
  makeCustomerRepository,
};
