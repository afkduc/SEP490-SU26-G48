const { success } = require('../../utils/response');

class AdminController {
  constructor() {
    this.getDashboardStats = this.getDashboardStats.bind(this);
    this.listUsers = this.listUsers.bind(this);
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

  listUsers(req, res, next) {
    try {
      return success(res, [], 'Danh sách người dùng (chỉ admin)');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AdminController;