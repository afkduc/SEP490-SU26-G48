const { success } = require('../../utils/response');
const AdminUserService = require('../../application/services/AdminUserService');
const AdminUserRepositoryImpl = require('../../infrastructure/repositories/AdminUserRepositoryImpl');

class AdminController {
  constructor() {
    const adminUserRepository = new AdminUserRepositoryImpl();
    this.adminUserService = new AdminUserService({ adminUserRepository });

    this.getDashboardStats = this.getDashboardStats.bind(this);
    this.listUsers = this.listUsers.bind(this);
    this.listBranches = this.listBranches.bind(this);
  }

  getDashboardStats(req, res, next) {
    try {
      return success(
        res,
        {
          totalUsers: 0,
          totalBranches: 0,
          activeSessions: 0,
          generatedAt: new Date().toISOString(),
          admin: { id: req.user.userId, email: req.user.email, name: req.user.name },
        },
        'Thống kê admin'
      );
    } catch (err) {
      next(err);
    }
  }

  listUsers = async (req, res, next) => {
    try {
      const result = await this.adminUserService.listUsers(req.query);
      return success(res, result, 'Danh sach nguoi dung (chi admin)');
    } catch (err) {
      next(err);
    }
  };

  listBranches = async (req, res, next) => {
    try {
      const result = await this.adminUserService.listBranches();
      return success(res, result, 'Danh sach chi nhanh (dropdown)');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AdminController;