const UserRepositoryImpl = require('./UserRepositoryImpl');
const ProductRepositoryImpl = require('./ProductRepositoryImpl');
const RepairSettlementRepositoryImpl = require('./RepairSettlementRepositoryImpl');
const InventoryRepositoryImpl = require('./InventoryRepositoryImpl');

function makeUserRepository() {
  return new UserRepositoryImpl();
}

function makeProductRepository() {
  return new ProductRepositoryImpl();
}

function makeRepairSettlementRepository() {
  return new RepairSettlementRepositoryImpl();
}

function makeInventoryRepository() {
  return new InventoryRepositoryImpl();
}

module.exports = {
  makeUserRepository,
  makeProductRepository,
  makeRepairSettlementRepository,
  makeInventoryRepository,
};
