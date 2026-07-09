const UserService = require('./UserService');
const ProductService = require('./ProductService');
const RepairSettlementService = require('./RepairSettlementService');
const {
  makeUserRepository,
  makeProductRepository,
  makeRepairSettlementRepository,
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

module.exports = {
  UserService,
  ProductService,
  RepairSettlementService,
  makeUserService,
  makeProductService,
  makeRepairSettlementService,
};
