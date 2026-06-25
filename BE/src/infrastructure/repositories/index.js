const UserRepositoryImpl = require('./UserRepositoryImpl');

function makeUserRepository() {
  return new UserRepositoryImpl();
}

module.exports = {
  makeUserRepository,
};
