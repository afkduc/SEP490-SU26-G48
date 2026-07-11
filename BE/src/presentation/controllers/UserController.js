const { success } = require('../../utils/response');

class UserController {
  constructor({ userService }) {
    this.userService = userService;
  }

  getAll = async (req, res, next) => {
    try {
      const users = await this.userService.getAllUsers();
      return success(res, users, 'Users retrieved');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const user = await this.userService.getUserById(req.params.id);
      return success(res, user, 'User retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const user = await this.userService.createUser(req.body);
      return success(res, user, 'User created', 201);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const user = await this.userService.updateUser(req.params.id, req.body, req.user.id);
      return success(res, user, 'User updated');
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const user = await this.userService.deleteUser(req.params.id, req.user.id);
      return success(res, user, 'User deleted');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = UserController;
