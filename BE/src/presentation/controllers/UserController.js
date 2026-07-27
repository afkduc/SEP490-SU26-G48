const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

class UserController {
  constructor({ userService }) {
    this.userService = userService;
    this.notificationService = new NotificationService();
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
      await auditCrud.create(req, {
        tableName: 'users',
        entityCode: user?.user_code || user?.userName || null,
        recordId: user?.id || null,
        entityName: 'Người dùng',
        data: req.body,
      });
      await this.notificationService.notifyAdmins('USER_CREATED', {
        actorName: req.user?.name || req.user?.email || 'Quản lý',
        targetName: user?.full_name || user?.userName || '',
        targetCode: user?.user_code || '',
        userId: user?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[UserController] notifyAdmins:', e.message));
      return success(res, user, 'User created', 201);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const user = await this.userService.updateUser(req.params.id, req.body, req.user.id);
      await auditCrud.update(req, {
        tableName: 'users',
        entityCode: user?.user_code || user?.userName || `ID-${req.params.id}`,
        recordId: user?.id || Number(req.params.id) || null,
        entityName: 'Người dùng',
        newData: req.body,
      });
      await this.notificationService.notifyAdmins('USER_UPDATED', {
        actorName: req.user?.name || req.user?.email || 'Quản lý',
        targetName: user?.full_name || user?.userName || `ID-${req.params.id}`,
        targetCode: user?.user_code || '',
        userId: user?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[UserController] notifyAdmins:', e.message));
      return success(res, user, 'User updated');
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const ApiError = require('../../utils/ApiError');
      // Hard delete đã bỏ — dùng PUT /admin/users/:id status=inactive.
      throw new ApiError(
        405,
        'Hard delete user khong duoc ho tro. Su dung cap nhat status inactive (Disable/Ngung).'
      );
    } catch (err) {
      next(err);
    }
  };
}

module.exports = UserController;
