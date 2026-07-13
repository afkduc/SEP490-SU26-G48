const UserRepositoryImpl = require('./UserRepositoryImpl');
const ProductRepositoryImpl = require('./ProductRepositoryImpl');
const RepairSettlementRepositoryImpl = require('./RepairSettlementRepositoryImpl');
const RepairOrderRepositoryImpl = require('./RepairOrderRepositoryImpl');
const InventoryRepositoryImpl = require('./InventoryRepositoryImpl');
const SupplierRepositoryImpl = require('./SupplierRepositoryImpl');
const ImportRequestRepositoryImpl = require('./ImportRequestRepositoryImpl');

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

function makeSupplierRepository() {
  return new SupplierRepositoryImpl();
}

function makeImportRequestRepository() {
  return new ImportRequestRepositoryImpl();
}

module.exports = {
  makeUserRepository,
  makeProductRepository,
  makeRepairSettlementRepository,
  makeRepairOrderRepository,
  makeInventoryRepository,
  makeSupplierRepository,
  makeImportRequestRepository,
};
