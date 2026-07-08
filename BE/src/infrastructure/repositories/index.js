const UserRepositoryImpl = require('./UserRepositoryImpl');
const ProductRepositoryImpl = require('./ProductRepositoryImpl');
const InventoryRepositoryImpl = require('./InventoryRepositoryImpl');

function makeUserRepository() {
  return new UserRepositoryImpl();
}

function makeProductRepository() {
  return new ProductRepositoryImpl();
}

function makeInventoryRepository() {
  return new InventoryRepositoryImpl();
}

module.exports = {
  makeUserRepository,
  makeProductRepository,
  makeInventoryRepository,
};
