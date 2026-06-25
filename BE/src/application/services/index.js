const UserService = require('./UserService');
const { makeUserRepository } = require('../../infrastructure/repositories');

function makeUserService() {
  return new UserService({ userRepository: makeUserRepository() });
}

module.exports = {
  UserService,
  makeUserService,
};
