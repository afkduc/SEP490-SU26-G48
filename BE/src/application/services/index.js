const UserService = require('./UserService');
const ProductService = require('./ProductService');
const { makeUserRepository } = require('../../infrastructure/repositories');
const { makeProductRepository } = require('../../infrastructure/repositories');

function makeUserService() {
  return new UserService({ userRepository: makeUserRepository() });
}

function makeProductService() {
  return new ProductService({ productRepository: makeProductRepository() });
}

module.exports = {
  UserService,
  ProductService,
  makeUserService,
  makeProductService,
};
