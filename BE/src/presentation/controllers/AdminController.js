const { success } = require('../../utils/response');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const AdminUserService = require('../../application/services/AdminUserService');
const AdminUserRepositoryImpl = require('../../infrastructure/repositories/AdminUserRepositoryImpl');
const RoleService = require('../../application/services/RoleService');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const UserRoleService = require('../../application/services/UserRoleService');
const UserRoleRepositoryImpl = require('../../infrastructure/repositories/UserRoleRepositoryImpl');

class AdminController {
  constructor() {
    const adminUserRepository = new AdminUserRepositoryImpl();
    this.adminUserService = new AdminUserService({ adminUserRepository });

    const roleRepository = new RoleRepositoryImpl();
    this.roleService = new RoleService({ roleRepository });

    const userRoleRepository = new UserRoleRepositoryImpl();
    const roleRepo = new RoleRepositoryImpl();
    this.userRoleService = new UserRoleService({ userRoleRepository, roleRepository: roleRepo });

    this.getDashboardStats = this.getDashboardStats.bind(this);
    this.listUsers = this.listUsers.bind(this);
    this.listBranches = this.listBranches.bind(this);
    this.listRoles = this.listRoles.bind(this);
    this.getRoleDetail = this.getRoleDetail.bind(this);
    this.getUserRoles = this.getUserRoles.bind(this);
    this.assignRoles = this.assignRoles.bind(this);
    this.revokeRole = this.revokeRole.bind(this);
    this.createUser = this.createUser.bind(this);
    this.updateUser = this.updateUser.bind(this);
    this.getUserDetail = this.getUserDetail.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
  }

  getDashboardStats = async (req, res, next) => {
    try {
      const stats = await this.adminUserService.getDashboardStats();
      return success(
        res,
        {
          ...stats,
          generatedAt: new Date().toISOString(),
          admin: { id: req.user.userId, email: req.user.email, name: req.user.name },
        },
        'Thong ke admin'
      );
    } catch (err) {
      next(err);
    }
  };

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

  // UC-11: list all roles with user count
  listRoles = async (req, res, next) => {
    try {
      const result = await this.roleService.listRoles();
      return success(res, result, 'Danh sach role');
    } catch (err) {
      next(err);
    }
  };

  // UC-11: role detail
  getRoleDetail = async (req, res, next) => {
    try {
      const role = await this.roleService.getRoleDetail(req.params.id);
      return success(res, role, 'Chi tiet role');
    } catch (err) {
      next(err);
    }
  };

  // UC-12: lay roles cua user
  getUserRoles = async (req, res, next) => {
    try {
      const roles = await this.userRoleService.getUserRoles(req.params.userId);
      return success(res, roles, 'Roles cua nguoi dung');
    } catch (err) {
      next(err);
    }
  };

  // UC-12: gan role(s) cho user
  assignRoles = async (req, res, next) => {
    try {
      const { roleIds } = req.body;
      const roles = await this.userRoleService.assignRoles(req.params.userId, roleIds);
      return success(res, roles, 'Gan role thanh cong');
    } catch (err) {
      next(err);
    }
  };

  // UC-12: xoa 1 role khoi user
  revokeRole = async (req, res, next) => {
    try {
      const roles = await this.userRoleService.revokeRole(
        req.params.userId,
        req.params.roleId
      );
      return success(res, roles, 'Xoa role thanh cong');
    } catch (err) {
      next(err);
    }
  };

  async createUser(req, res, next) {
    try {
      const user = await this.adminUserService.createUser(req.body);
      return success(res, user, 'Tao nguoi dung thanh cong', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req, res, next) {
    try {
      const { userId, status, roleId, branchId } = req.body;
      const updated = await this.adminUserService.updateUser({
        userId,
        status,
        roleId,
        branchId,
      });
      return success(res, updated, 'Cap nhat nguoi dung thanh cong');
    } catch (err) {
      next(err);
    }
  }

  async getUserDetail(req, res, next) {
    try {
      const user = await this.adminUserService.getUserDetail(req.params.id);
      return success(res, user, 'Chi tiet nguoi dung');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/users/:id/reset-password
   * Admin reset mat khau cho user bat ky (tru chinh admin dang dang nhap).
   * Tra ve mat khau plain text 1 lan duy nhat de admin gui cho user.
   */
  async resetPassword(req, res, next) {
    try {
      const targetUserId = Number(req.params.id);
      const currentUserId = req.user?.userId;

      // Khong cho admin tu reset MK chinh minh (tranh tu khoa tai khoan)
      if (currentUserId && targetUserId === currentUserId) {
        return next(new (require('../../utils/ApiError'))(
          400,
          'Khong the tu reset mat khau cua chinh minh. Hay lien he admin khac.'
        ));
      }

      // `mustChangePassword` mac dinh true (co the client override qua body)
      const mustChangePassword = req.body?.mustChangePassword !== false;

      const result = await this.adminUserService.resetPassword({
        userId: targetUserId,
        mustChangePassword,
      });
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/reissue-token
   * Cap lai JWT cho user hien tai, lay roles tu DB de dam bao role admin
   * co trong token (phong truong hop token cu khong co role admin).
   * Endpoint nay dat TRUOC middleware requireAdmin trong adminRoutes.js,
   * nen khong bi chan khi token cu thieu role admin.
   */
  reissueToken = async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new (require('../../utils/ApiError'))(401, 'Token khong hop le'));
      }

      const roles = await this.userRoleService.getUserRoles(userId);
      const roleNames = roles.map((r) => r.roleName).filter(Boolean);

      const newToken = jwt.sign(
        {
          userId,
          email: req.user.email,
          name: req.user.name,
          roles: roleNames,
          branchId: req.user.branchId,
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      return success(res, { token: newToken, roles: roleNames }, 'Cap lai token thanh cong');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AdminController;
