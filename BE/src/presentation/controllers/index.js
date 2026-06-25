const { makeUserService } = require('../../application/services');

function makeUserController() {
  return new (require('./UserController'))({ userService: makeUserService() });
}

module.exports = { makeUserController };
