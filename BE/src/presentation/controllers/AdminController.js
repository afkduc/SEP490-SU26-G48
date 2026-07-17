const { success } = require('../../utils/response');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const AdminUserService = require('../../application/services/AdminUserService');
const AdminUserRepositoryImpl = require('../../infrastructure/repositories/AdminUserRepositoryImpl');
const RoleService = require('../../application/services/RoleService');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const UserRoleService = require('../../application/services/UserRoleService');
const UserRoleRepositoryImpl = require('../../infrastructure/repositories/UserRoleRepositoryImpl');
const AuditService = require('../../application/services/AuditService');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const { exportUsersToExcel } = require('../../utils/excelExporter');
const BranchService = require('../../application/services/BranchService');
const DeviceService = require('../../application/services/DeviceService');
const SpecialtyService = require('../../application/services/SpecialtyService');
const SecurityAlertService = require('../../application/services/SecurityAlertService');

class AdminController {
  constructor() {
    const adminUserRepository = new AdminUserRepositoryImpl();
    this.adminUserService = new AdminUserService({ adminUserRepository });

    const roleRepository = new RoleRepositoryImpl();
    this.roleService = new RoleService({ roleRepository });

    const userRoleRepository = new UserRoleRepositoryImpl();
    const roleRepo = new RoleRepositoryImpl();
    this.userRoleService = new UserRoleService({ userRoleRepository, roleRepository: roleRepo });

    this.auditService = new AuditService(AuditRepository);
    this.branchService = new BranchService();
    this.deviceService = new DeviceService();
    this.specialtyService = new SpecialtyService();
    this.securityAlertService = new SecurityAlertService();

    this.getDashboardStats = this.getDashboardStats.bind(this);
    this.listUsers = this.listUsers.bind(this);
    this.exportUsers = this.exportUsers.bind(this);
    this.listBranches = this.listBranches.bind(this);
    this.listBranchesFull = this.listBranchesFull.bind(this);
    this.getBranchDetail = this.getBranchDetail.bind(this);
    this.getBranchStats = this.getBranchStats.bind(this);
    this.getManagerCandidates = this.getManagerCandidates.bind(this);
    this.createBranch = this.createBranch.bind(this);
    this.updateBranch = this.updateBranch.bind(this);
    this.deactivateBranch = this.deactivateBranch.bind(this);
    this.reactivateBranch = this.reactivateBranch.bind(this);
    this.listRoles = this.listRoles.bind(this);
    this.getRoleDetail = this.getRoleDetail.bind(this);
    this.listPermissions = this.listPermissions.bind(this);
    this.getRolePermissions = this.getRolePermissions.bind(this);
    this.setRolePermissions = this.setRolePermissions.bind(this);
    this.getRoleUsers = this.getRoleUsers.bind(this);
    this.createRole = this.createRole.bind(this);
    this.updateRole = this.updateRole.bind(this);
    this.deleteRole = this.deleteRole.bind(this);
    this.listDevices = this.listDevices.bind(this);
    this.listUserDevices = this.listUserDevices.bind(this);
    this.forceLogoutDevice = this.forceLogoutDevice.bind(this);
    this.forceLogoutAllOtherDevices = this.forceLogoutAllOtherDevices.bind(this);
    this.listSpecialties = this.listSpecialties.bind(this);
    this.createSpecialty = this.createSpecialty.bind(this);
    this.updateSpecialty = this.updateSpecialty.bind(this);
    this.deleteSpecialty = this.deleteSpecialty.bind(this);
    this.getUserSpecialties = this.getUserSpecialties.bind(this);
    this.setUserSpecialties = this.setUserSpecialties.bind(this);
    this.listSecurityAlerts = this.listSecurityAlerts.bind(this);
    this.acknowledgeAlert = this.acknowledgeAlert.bind(this);
    this.listSecurityAlerts = this.listSecurityAlerts.bind(this);
    this.acknowledgeAlert = this.acknowledgeAlert.bind(this);
    this.listSecurityAlerts = this.listSecurityAlerts.bind(this);
    this.acknowledgeAlertCounts = this.acknowledgeAlertCounts.bind(this);
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

  exportUsers = async (req, res, next) => {
    try {
      const { items } = await this.adminUserService.exportUsers(req.query);
      const buffer = await exportUsersToExcel(items, req.query);

      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const filename = `users_${yyyy}${mm}${dd}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      next(err);
    }
  };

  // Branches
  listBranches = async (req, res, next) => {
    try {
      const result = await this.adminUserService.listBranches();
      return success(res, result, 'Danh sach chi nhanh (dropdown)');
    } catch (err) {
      next(err);
    }
  };

  listBranchesFull = async (req, res, next) => {
    try {
      const branches = await this.branchService.list();
      return success(res, { items: branches, total: branches.length }, 'Danh sach chi nhanh (admin)');
    } catch (err) {
      next(err);
    }
  };

  getBranchDetail = async (req, res, next) => {
    try {
      const branch = await this.branchService.getById(req.params.id);
      return success(res, branch, 'Chi tiet chi nhanh');
    } catch (err) {
      next(err);
    }
  };

  getBranchStats = async (req, res, next) => {
    try {
      const stats = await this.branchService.getStats(req.params.id);
      return success(res, stats, 'Thong ke chi nhanh');
    } catch (err) {
      next(err);
    }
  };

  getManagerCandidates = async (req, res, next) => {
    try {
      const result = await this.branchService.getManagerCandidates();
      return success(res, result, 'Danh sach ung vien lam quan ly');
    } catch (err) {
      next(err);
    }
  };

  createBranch = async (req, res, next) => {
    try {
      const branch = await this.branchService.create(req.body);
      return success(res, branch, 'Tao chi nhanh thanh cong', 201);
    } catch (err) {
      next(err);
    }
  };

  updateBranch = async (req, res, next) => {
    try {
      const branch = await this.branchService.update(req.params.id, req.body);
      return success(res, branch, 'Cap nhat chi nhanh thanh cong');
    } catch (err) {
      next(err);
    }
  };

  deactivateBranch = async (req, res, next) => {
    try {
      const branch = await this.branchService.deactivate(req.params.id);
      return success(res, branch, 'Ngung hoat dong chi nhanh');
    } catch (err) {
      next(err);
    }
  };

  reactivateBranch = async (req, res, next) => {
    try {
      const branch = await this.branchService.reactivate(req.params.id);
      return success(res, branch, 'Kich hoat lai chi nhanh');
    } catch (err) {
      next(err);
    }
  };

  // Roles (UC-11)
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

  // UC-11: list all permissions
  listPermissions = async (req, res, next) => {
    try {
      const permissions = await this.roleService.listPermissions();
      return success(res, { items: permissions, total: permissions.length }, 'Danh sach quyen');
    } catch (err) {
      next(err);
    }
  };

  // UC-11: get permissions of a role
  getRolePermissions = async (req, res, next) => {
    try {
      const permissions = await this.roleService.getRolePermissions(req.params.id);
      return success(res, { items: permissions, total: permissions.length }, 'Quyen cua vai tro');
    } catch (err) {
      next(err);
    }
  };

  // UC-11: set permissions for a role
  setRolePermissions = async (req, res, next) => {
    try {
      const { permissionIds } = req.body;
      const permissions = await this.roleService.setRolePermissions(
        req.params.id,
        Array.isArray(permissionIds) ? permissionIds.map(Number) : []
      );
      return success(res, { items: permissions, total: permissions.length }, 'Cap nhat quyen vai tro thanh cong');
    } catch (err) {
      next(err);
    }
  };

  // UC-11: get users having a role
  getRoleUsers = async (req, res, next) => {
    try {
      const users = await this.roleService.getRoleUsers(req.params.id);
      return success(res, { items: users, total: users.length }, 'Nguoi dung co vai tro nay');
    } catch (err) {
      next(err);
    }
  };

  // UC-11: create role
  createRole = async (req, res, next) => {
    try {
      const { roleName, roleLabel } = req.body;
      const role = await this.roleService.createRole({ roleName, roleLabel });
      return success(res, role, 'Tao vai tro thanh cong', 201);
    } catch (err) {
      next(err);
    }
  };

  // UC-11: update role
  updateRole = async (req, res, next) => {
    try {
      const { roleLabel } = req.body;
      const role = await this.roleService.updateRole(req.params.id, { roleLabel });
      return success(res, role, 'Cap nhat vai tro thanh cong');
    } catch (err) {
      next(err);
    }
  };

  // UC-11: delete role
  deleteRole = async (req, res, next) => {
    try {
      const result = await this.roleService.deleteRole(req.params.id);
      return success(res, result, 'Xoa vai tro thanh cong');
    } catch (err) {
      next(err);
    }
  };

  // Devices
  listDevices = async (req, res, next) => {
    try {
      const { userId, search, page, pageSize } = req.query;
      const result = await this.deviceService.listAll({
        userId,
        search,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
      });
      return success(res, result, 'Danh sach thiet bi');
    } catch (err) {
      next(err);
    }
  };

  listUserDevices = async (req, res, next) => {
    try {
      const devices = await this.deviceService.listByUser(req.params.userId);
      return success(res, { items: devices, total: devices.length }, 'Thiet bi cua nguoi dung');
    } catch (err) {
      next(err);
    }
  };

  forceLogoutDevice = async (req, res, next) => {
    try {
      const result = await this.deviceService.forceLogoutDevice(req.params.deviceId);
      return success(res, result, 'Da dang xuat khoi thiet bi');
    } catch (err) {
      next(err);
    }
  };

  forceLogoutAllOtherDevices = async (req, res, next) => {
    try {
      const { userId, currentDeviceId } = req.params;
      const result = await this.deviceService.forceLogoutAllOtherDevices(userId, currentDeviceId);
      return success(res, result, 'Da dang xuat tat ca thiet bi khac');
    } catch (err) {
      next(err);
    }
  };

  // Specialties
  listSpecialties = async (req, res, next) => {
    try {
      const specialties = await this.specialtyService.list();
      return success(res, { items: specialties, total: specialties.length }, 'Danh sach chuyen mon');
    } catch (err) {
      next(err);
    }
  };

  createSpecialty = async (req, res, next) => {
    try {
      const specialty = await this.specialtyService.create(req.body);
      return success(res, specialty, 'Tao chuyen mon thanh cong', 201);
    } catch (err) {
      next(err);
    }
  };

  updateSpecialty = async (req, res, next) => {
    try {
      const specialty = await this.specialtyService.update(req.params.id, req.body);
      return success(res, specialty, 'Cap nhat chuyen mon thanh cong');
    } catch (err) {
      next(err);
    }
  };

  deleteSpecialty = async (req, res, next) => {
    try {
      const result = await this.specialtyService.delete(req.params.id);
      return success(res, result, 'Xoa chuyen mon thanh cong');
    } catch (err) {
      next(err);
    }
  };

  getUserSpecialties = async (req, res, next) => {
    try {
      const specialties = await this.specialtyService.getUserSpecialties(req.params.userId);
      return success(res, { items: specialties, total: specialties.length }, 'Chuyen mon cua nguoi dung');
    } catch (err) {
      next(err);
    }
  };

  setUserSpecialties = async (req, res, next) => {
    try {
      const { specialtyIds } = req.body;
      const specialties = await this.specialtyService.setUserSpecialties(
        req.params.userId,
        Array.isArray(specialtyIds) ? specialtyIds.map(Number) : []
      );
      return success(res, { items: specialties, total: specialties.length }, 'Cap nhat chuyen mon nguoi dung thanh cong');
    } catch (err) {
      next(err);
    }
  };

  // Security Alerts
  listSecurityAlerts = async (req, res, next) => {
    try {
      const { severity, isAcknowledged, page, pageSize } = req.query;
      const result = await this.securityAlertService.list({
        severity,
        isAcknowledged: isAcknowledged !== undefined ? isAcknowledged === 'true' : undefined,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
      });
      return success(res, result, 'Danh sach canh bao bao mat');
    } catch (err) {
      next(err);
    }
  };

  acknowledgeAlert = async (req, res, next) => {
    try {
      const alert = await this.securityAlertService.acknowledge(req.params.id, req.user?.id);
      return success(res, alert, 'Da xu ly canh bao');
    } catch (err) {
      next(err);
    }
  };

  acknowledgeAlertCounts = async (req, res, next) => {
    try {
      const counts = await this.securityAlertService.getCounts();
      return success(res, counts, 'So luong canh bao');
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
      const newPassword = req.body?.newPassword;

      const result = await this.adminUserService.resetPassword({
        userId: targetUserId,
        mustChangePassword,
        newPassword,
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
