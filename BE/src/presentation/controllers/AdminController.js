const { success } = require('../../utils/response');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const AdminUserService = require('../../application/services/AdminUserService');
const AdminUserRepositoryImpl = require('../../infrastructure/repositories/AdminUserRepositoryImpl');
const RoleService = require('../../application/services/RoleService');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const UserRoleService = require('../../application/services/UserRoleService');
const UserRoleRepositoryImpl = require('../../infrastructure/repositories/UserRoleRepositoryImpl');
const UserRepositoryImpl = require('../../infrastructure/repositories/UserRepositoryImpl');
const PermissionService = require('../../application/services/PermissionService');
const AuditService = require('../../application/services/AuditService');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const { exportUsersToExcel } = require('../../utils/excelExporter');
const BranchService = require('../../application/services/BranchService');
const DeviceService = require('../../application/services/DeviceService');
const SpecialtyService = require('../../application/services/SpecialtyService');
const SecurityAlertService = require('../../application/services/SecurityAlertService');
const NotificationService = require('../../application/services/NotificationService');
const { auditCrud } = require('../../utils/auditHelper');
const { emitPermissionChanged } = require('../../application/events/PermissionEvents');
const PermissionGroupService = require('../../application/services/PermissionGroupService');
const PermissionGroupRepositoryImpl = require('../../infrastructure/repositories/PermissionGroupRepositoryImpl');

class AdminController {
  constructor() {
    const adminUserRepository = new AdminUserRepositoryImpl();
    this.adminUserService = new AdminUserService({ adminUserRepository });

    const roleRepository = new RoleRepositoryImpl();
    const permissionService = new PermissionService({ roleRepository });
    this.roleService = new RoleService({ roleRepository, permissionService });

    const userRoleRepository = new UserRoleRepositoryImpl();
    const roleRepo = new RoleRepositoryImpl();
    const userRepo = new UserRepositoryImpl();
    this.userRoleService = new UserRoleService({ userRoleRepository, roleRepository: roleRepo, userRepository: userRepo });

    // Permission Groups (Phase 3)
    const groupRepository = new PermissionGroupRepositoryImpl();
    this.permissionGroupService = new PermissionGroupService({
      groupRepository,
      permissionService,
      roleRepository,
    });

    this.auditService = new AuditService(AuditRepository);
    this.branchService = new BranchService();
    this.deviceService = new DeviceService();
    this.specialtyService = new SpecialtyService();
    this.securityAlertService = new SecurityAlertService();
    this.notificationService = new NotificationService();
    this.vehicleBrandRepository = new (require('../../infrastructure/repositories/VehicleBrandRepository'))();

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
    this.listPermissionGroups = this.listPermissionGroups.bind(this);
    this.getPermissionGroupDetail = this.getPermissionGroupDetail.bind(this);
    this.getRoleGroupIds = this.getRoleGroupIds.bind(this);
    this.setRoleGroups = this.setRoleGroups.bind(this);
    this.setRoleGroupsMatrix = this.setRoleGroupsMatrix.bind(this);
    this.createRole = this.createRole.bind(this);
    this.updateRole = this.updateRole.bind(this);
    this.toggleRoleStatus = this.toggleRoleStatus.bind(this);
    this.listDevices = this.listDevices.bind(this);
    this.listUserDevices = this.listUserDevices.bind(this);
    this.forceLogoutDevice = this.forceLogoutDevice.bind(this);
    this.forceLogoutAllOtherDevices = this.forceLogoutAllOtherDevices.bind(this);
    this.forceLogoutAllDevices = this.forceLogoutAllDevices.bind(this);
    this.listSpecialties = this.listSpecialties.bind(this);
    this.createSpecialty = this.createSpecialty.bind(this);
    this.updateSpecialty = this.updateSpecialty.bind(this);
    this.toggleSpecialtyStatus = this.toggleSpecialtyStatus.bind(this);
    this.getUserSpecialties = this.getUserSpecialties.bind(this);
    this.setUserSpecialties = this.setUserSpecialties.bind(this);
    this.listSecurityAlerts = this.listSecurityAlerts.bind(this);
    this.acknowledgeAlert = this.acknowledgeAlert.bind(this);
    this.acknowledgeAllAlerts = this.acknowledgeAllAlerts.bind(this);
    this.acknowledgeAlertCounts = this.acknowledgeAlertCounts.bind(this);
    this.getRecentLoginSessions = this.getRecentLoginSessions.bind(this);
    this.getUserRoles = this.getUserRoles.bind(this);
    this.assignRoles = this.assignRoles.bind(this);
    this.revokeRole = this.revokeRole.bind(this);
    this.createUser = this.createUser.bind(this);
    this.updateUser = this.updateUser.bind(this);
    this.getUserDetail = this.getUserDetail.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.reissueToken = this.reissueToken.bind(this);
    this.refreshPermissions = this.refreshPermissions.bind(this);
    this.debugPermissions = this.debugPermissions.bind(this);
    this.cleanupDuplicateSessions = this.cleanupDuplicateSessions.bind(this);
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
      await auditCrud.create(req, {
        tableName: 'branches',
        entityCode: branch?.branch_code || branch?.code || null,
        recordId: branch?.id || null,
        entityName: 'Chi nhánh',
        data: req.body,
      });
      await this.notificationService.notifyAdmins('BRANCH_CREATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: branch?.branch_name || branch?.name || '',
        targetCode: branch?.branch_code || '',
        userId: branch?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins BRANCH_CREATED:', e.message));
      return success(res, branch, 'Tao chi nhanh thanh cong', 201);
    } catch (err) {
      next(err);
    }
  };

  updateBranch = async (req, res, next) => {
    try {
      const branch = await this.branchService.update(req.params.id, req.body);
      await auditCrud.update(req, {
        tableName: 'branches',
        entityCode: branch?.branch_code || `ID-${req.params.id}`,
        recordId: branch?.id || Number(req.params.id) || null,
        entityName: 'Chi nhánh',
        newData: req.body,
      });
      await this.notificationService.notifyAdmins('BRANCH_UPDATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: branch?.branch_name || '',
        targetCode: branch?.branch_code || '',
        userId: branch?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins BRANCH_UPDATED:', e.message));
      return success(res, branch, 'Cap nhat chi nhanh thanh cong');
    } catch (err) {
      next(err);
    }
  };

  deactivateBranch = async (req, res, next) => {
    try {
      const branch = await this.branchService.deactivate(req.params.id);
      await auditCrud.update(req, {
        tableName: 'branches',
        entityCode: branch?.branch_code || `ID-${req.params.id}`,
        recordId: branch?.id || Number(req.params.id) || null,
        entityName: 'Chi nhánh',
        newData: { status: 'inactive' },
        description: `Ngừng hoạt động chi nhánh ${branch?.branch_code || req.params.id}`,
      });
      await this.notificationService.notifyAdmins('BRANCH_DEACTIVATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: branch?.branch_name || '',
        targetCode: branch?.branch_code || '',
        userId: branch?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins BRANCH_DEACTIVATED:', e.message));
      return success(res, branch, 'Ngung hoat dong chi nhanh');
    } catch (err) {
      next(err);
    }
  };

  reactivateBranch = async (req, res, next) => {
    try {
      const branch = await this.branchService.reactivate(req.params.id);
      await auditCrud.update(req, {
        tableName: 'branches',
        entityCode: branch?.branch_code || `ID-${req.params.id}`,
        recordId: branch?.id || Number(req.params.id) || null,
        entityName: 'Chi nhánh',
        newData: { status: 'active' },
        description: `Kích hoạt lại chi nhánh ${branch?.branch_code || req.params.id}`,
      });
      await this.notificationService.notifyAdmins('BRANCH_REACTIVATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: branch?.branch_name || '',
        targetCode: branch?.branch_code || '',
        userId: branch?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins BRANCH_REACTIVATED:', e.message));
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

  // UC-11: list roles + permissions (1 call, khong N+1)
  listRolesWithPermissions = async (req, res, next) => {
    try {
      const result = await this.roleService.listRolesWithPermissions();
      return success(res, result, 'Danh sach vai tro kem quyen');
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
      const ApiError = require('../../utils/ApiError');
      const { permissionIds } = req.body;
      if (!Array.isArray(permissionIds)) {
        throw new ApiError(400, 'permissionIds phai la mang');
      }
      // Validation chi tiet (loai bo NaN, check ton tai) lam trong RoleService.setRolePermissions
      const permissions = await this.roleService.setRolePermissions(
        req.params.id,
        permissionIds
      );
      await auditCrud.update(req, {
        tableName: 'role_permissions',
        entityCode: `ID-${req.params.id}`,
        recordId: Number(req.params.id) || null,
        entityName: 'Phân quyền vai trò',
        newData: { permissionIds },
        description: `Cập nhật quyền cho vai trò ID ${req.params.id} (${permissions.length || 0} quyền)`,
      });
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
      await auditCrud.create(req, {
        tableName: 'roles',
        entityCode: role?.role_code || roleName || null,
        recordId: role?.id || null,
        entityName: 'Vai trò',
        data: req.body,
      });
      await this.notificationService.notifyAdmins('ROLE_CREATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: role?.role_name || role?.roleLabel || '',
        targetCode: role?.role_code || '',
        userId: role?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins ROLE_CREATED:', e.message));
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
      await auditCrud.update(req, {
        tableName: 'roles',
        entityCode: role?.role_code || `ID-${req.params.id}`,
        recordId: role?.id || Number(req.params.id) || null,
        entityName: 'Vai trò',
        newData: { roleLabel },
      });
      await this.notificationService.notifyAdmins('ROLE_UPDATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: role?.role_name || `ID-${req.params.id}`,
        targetCode: role?.role_code || '',
        userId: role?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins ROLE_UPDATED:', e.message));
      return success(res, role, 'Cap nhat vai tro thanh cong');
    } catch (err) {
      next(err);
    }
  };

  toggleRoleStatus = async (req, res, next) => {
    try {
      const role = await this.roleService.toggleStatus(req.params.id);
      await auditCrud.update(req, {
        tableName: 'roles',
        entityCode: role?.role_code || `ID-${req.params.id}`,
        recordId: role?.id || Number(req.params.id) || null,
        entityName: 'Vai trò',
        newData: { isActive: role?.is_active },
        description: `${role?.is_active ? 'Kích hoạt' : 'Vô hiệu hóa'} vai trò ${role?.role_code || req.params.id}`,
      });
      await this.notificationService.notifyAdmins(role?.is_active ? 'ROLE_ENABLED' : 'ROLE_DISABLED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: role?.role_name || `ID-${req.params.id}`,
        targetCode: role?.role_code || '',
        userId: role?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins toggleRole:', e.message));
      return success(res, role, 'Cap nhat trang thai vai tro thanh cong');
    } catch (err) {
      next(err);
    }
  };

  // Devices
  listDevices = async (req, res, next) => {
    try {
      const { userId, search, browser, os, isCurrent, isTrusted, dateFrom, dateTo, page, pageSize } = req.query;
      const result = await this.deviceService.listAll({
        userId,
        search,
        browser,
        os,
        isCurrent,
        isTrusted,
        dateFrom,
        dateTo,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
      });
      return success(res, result, 'Danh sach thiet bi');
    } catch (err) {
      next(err);
    }
  };

  setDeviceTrusted = async (req, res, next) => {
    try {
      const trusted = req.body?.trusted === true || req.body?.trusted === 1 || req.body?.trusted === 'true';
      const device = await this.deviceService.setTrustedByAdmin(req.params.deviceId, trusted);
      return success(res, device, trusted ? 'Đã đánh dấu thiết bị tin cậy' : 'Đã bỏ tin cậy thiết bị');
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
      await auditCrud.forceLogout(req, {
        targetUserName: result?.userName || null,
        reason: `Đăng xuất thiết bị ${req.params.deviceId}`,
      });
      return success(res, result, 'Da dang xuat khoi thiet bi');
    } catch (err) {
      next(err);
    }
  };

  forceLogoutAllOtherDevices = async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { currentDeviceId } = req.query;
      const result = await this.deviceService.forceLogoutAllOtherDevices(userId, currentDeviceId);
      await auditCrud.forceLogout(req, {
        targetUserName: `user-${userId}`,
        reason: `Đăng xuất tất cả thiết bị khác (${result?.revoked || 0} thiết bị)`,
      });
      return success(res, result, 'Da dang xuat tat ca thiet bi khac');
    } catch (err) {
      next(err);
    }
  };

  /**
   * Admin force logout ALL devices of a user (including current).
   * DELETE /api/admin/devices/user/:userId/all
   */
  forceLogoutAllDevices = async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ message: 'userId la bat buoc' });
      }
      const result = await this.deviceService.forceLogoutAllDevices(userId);
      await auditCrud.forceLogout(req, {
        targetUserName: `user-${userId}`,
        reason: `Buộc đăng xuất toàn bộ thiết bị của user (${result?.revoked || 0} thiết bị)`,
      });
      return success(res, result, `Da dang xuat ${result.revoked} thiet bi`);
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
      const actorInfo = {
        userId: req.user?.id,
        userName: req.user?.user_name,
        name: req.user?.full_name || req.user?.name,
      };
      const specialty = await this.specialtyService.create(req.body, actorInfo);
      await auditCrud.create(req, {
        tableName: 'specialties',
        entityCode: specialty?.specialty_code || specialty?.code || null,
        recordId: specialty?.id || null,
        entityName: 'Chuyên môn',
        data: req.body,
      });
      return success(res, specialty, 'Tao chuyen mon thanh cong', 201);
    } catch (err) {
      next(err);
    }
  };

  updateSpecialty = async (req, res, next) => {
    try {
      const actorInfo = {
        userId: req.user?.id,
        userName: req.user?.user_name,
        name: req.user?.full_name || req.user?.name,
      };
      const specialty = await this.specialtyService.update(req.params.id, req.body, actorInfo);
      await auditCrud.update(req, {
        tableName: 'specialties',
        entityCode: specialty?.specialty_code || `ID-${req.params.id}`,
        recordId: specialty?.id || Number(req.params.id) || null,
        entityName: 'Chuyên môn',
        newData: req.body,
      });
      return success(res, specialty, 'Cap nhat chuyen mon thanh cong');
    } catch (err) {
      next(err);
    }
  };

  toggleSpecialtyStatus = async (req, res, next) => {
    try {
      const specialty = await this.specialtyService.toggleStatus(req.params.id);
      await auditCrud.update(req, {
        tableName: 'specialties',
        entityCode: specialty?.specialty_code || `ID-${req.params.id}`,
        recordId: specialty?.id || Number(req.params.id) || null,
        entityName: 'Chuyên môn',
        newData: { isActive: specialty?.is_active },
        description: `${specialty?.is_active ? 'Kích hoạt' : 'Vô hiệu hóa'} chuyên môn ${specialty?.specialty_code || req.params.id}`,
      });
      return success(res, specialty, 'Cap nhat trang thai chuyen mon thanh cong');
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
      await auditCrud.update(req, {
        tableName: 'user_specialty',
        entityCode: `ID-${req.params.userId}`,
        recordId: Number(req.params.userId) || null,
        entityName: 'Chuyên môn nhân viên',
        newData: { specialtyIds },
        description: `Cập nhật chuyên môn cho user ID ${req.params.userId}`,
      });
      return success(res, { items: specialties, total: specialties.length }, 'Cap nhat chuyen mon nguoi dung thanh cong');
    } catch (err) {
      next(err);
    }
  };

  // Security Alerts
  listSecurityAlerts = async (req, res, next) => {
    try {
      const { severity, isAcknowledged, page, pageSize, collapsed, ruleKey, userId, related } = req.query;

      // ?related=1&ruleKey=...&userId=... → lịch sử đầy đủ nhóm (popup chi tiết)
      if (related === '1' || related === 'true') {
        const items = await this.securityAlertService.getRelated({
          ruleKey,
          userId: userId !== undefined && userId !== '' ? userId : null,
          limit: pageSize ? Number(pageSize) : 50,
        });
        return success(res, { items, total: items.length }, 'Lich su canh bao lien quan');
      }

      const result = await this.securityAlertService.list({
        severity,
        isAcknowledged: isAcknowledged !== undefined ? isAcknowledged === 'true' : undefined,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 10,
        collapsed: collapsed !== 'false',
      });
      return success(res, result, 'Danh sach canh bao bao mat');
    } catch (err) {
      next(err);
    }
  };

  acknowledgeAlert = async (req, res, next) => {
    try {
      const alert = await this.securityAlertService.acknowledge(req.params.id, req.user?.userId);
      return success(res, alert, 'Da xu ly canh bao');
    } catch (err) {
      next(err);
    }
  };

  acknowledgeAllAlerts = async (req, res, next) => {
    try {
      const result = await this.securityAlertService.acknowledgeAll(req.user?.userId);
      return success(res, result, `Da xu ly ${result?.acknowledgedCount || 0} canh bao`);
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

  // Realtime polling cho AdminLoginSessionsPage. FE goi moi 10s voi `since`
  // de lay cac session moi (login hoac logout) tu moc thoi gian cu.
  getRecentLoginSessions = async (req, res, next) => {
    try {
      const { since, limit } = req.query;
      const result = await this.auditService.getLoginSessionsSince(since, limit);
      return success(res, result, 'Cac phien dang nhap moi');
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
      await auditCrud.assignRole(req, {
        userName: roles?.[0]?.userName || `ID-${req.params.userId}`,
        roleName: roles?.[0]?.roleName || roleIds?.join(','),
      });
      // SSE push: user vua duoc gan role moi -> can refresh permission ngay.
      try {
        emitPermissionChanged({
          action: 'role_assigned',
          userIds: [Number(req.params.userId)],
          roleIds: (roleIds || []).map(Number).filter(Number.isFinite),
          actorUserId: req.user?.userId || null,
        });
      } catch (eventErr) {
        console.warn('[AdminController] emitPermissionChanged (assignRoles) failed:', eventErr.message);
      }
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
      await auditCrud.removeRole(req, {
        userName: roles?.[0]?.userName || `ID-${req.params.userId}`,
        roleName: `role-${req.params.roleId}`,
      });
      // SSE push: user vua bi revoke role -> mat quyen, can refresh ngay.
      try {
        emitPermissionChanged({
          action: 'role_revoked',
          userIds: [Number(req.params.userId)],
          roleIds: [Number(req.params.roleId)].filter(Number.isFinite),
          actorUserId: req.user?.userId || null,
        });
      } catch (eventErr) {
        console.warn('[AdminController] emitPermissionChanged (revokeRole) failed:', eventErr.message);
      }
      return success(res, roles, 'Xoa role thanh cong');
    } catch (err) {
      next(err);
    }
  };

  async createUser(req, res, next) {
    try {
      const user = await this.adminUserService.createUser(req.body);
      await auditCrud.create(req, {
        tableName: 'users',
        entityCode: user?.user_code || user?.userName || null,
        recordId: user?.id || null,
        entityName: 'Người dùng',
        data: req.body,
      });
      await this.notificationService.notifyAdmins('USER_CREATED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: user?.full_name || user?.userName || '',
        targetCode: user?.user_code || '',
        userId: user?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins USER_CREATED:', e.message));
      return success(res, user, 'Tao nguoi dung thanh cong', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req, res, next) {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        const ApiError = require('../../utils/ApiError');
        throw new ApiError(400, 'ID người dùng không hợp lệ');
      }
      const { firstName, lastName, email, phone, status, roleId, branchId, scopeAllBranches } = req.body;
      console.log('[AdminController] updateUser - params.id:', userId, 'body:', JSON.stringify(req.body));
      const oldData = {};
      try {
        const existing = await this.adminUserService.getUserDetail(userId);
        if (existing) {
          oldData.firstName = existing.firstName;
          oldData.lastName = existing.lastName;
          oldData.email = existing.email;
          oldData.phone = existing.phone;
          oldData.status = existing.status;
          oldData.roleId = existing.roleId;
          oldData.branchId = existing.branchId;
        }
      } catch (_) {}
      const updated = await this.adminUserService.updateUser({
        userId,
        firstName,
        lastName,
        email,
        phone,
        status,
        roleId,
        branchId,
        scopeAllBranches,
      });
      await auditCrud.update(req, {
        tableName: 'users',
        entityCode: updated?.user_code || updated?.userName || `ID-${userId}`,
        recordId: updated?.id || userId,
        entityName: 'Người dùng',
        oldData,
        newData: { firstName, lastName, email, phone, status, roleId, branchId },
      });
      const eventType = status === 'inactive' ? 'USER_DISABLED' : 'USER_UPDATED';

      // Gui notification cho chinh admin thuc hien
      await this.notificationService.notify(eventType, {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: updated?.full_name || updated?.userName || `ID-${userId}`,
        targetCode: updated?.user_code || '',
        userId: req.user?.userId,
      }).catch((e) => console.warn('[AdminController] notify USER_UPDATE:', e.message));

      // Gui notification cho cac admin khac (exclude chinh minh)
      await this.notificationService.notifyAdmins(eventType, {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: updated?.full_name || updated?.userName || `ID-${userId}`,
        targetCode: updated?.user_code || '',
        userId: updated?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins USER_UPDATE:', e.message));

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

      if (currentUserId && targetUserId === currentUserId) {
        return next(new (require('../../utils/ApiError'))(
          400,
          'Khong the tu reset mat khau cua chinh minh. Hay lien he admin khac.'
        ));
      }

      const newPassword = req.body?.newPassword;

      const result = await this.adminUserService.resetPassword({
        userId: targetUserId,
        newPassword,
      });

      await auditCrud.resetPassword(req, {
        targetUserName: result?.userName || result?.user_code || `ID-${targetUserId}`,
      });
      await this.notificationService.notifyAdmins('USER_PASSWORD_RESET', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: result?.full_name || result?.userName || '',
        targetCode: result?.user_code || '',
        userId: targetUserId,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[AdminController] notifyAdmins USER_PASSWORD_RESET:', e.message));

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

      // Lay permissions tu DB (bo qua cache de lay gia tri moi nhat -
      // tranh truong hop admin vua thay doi ma tran quyen nhung cache 60s
      // van con permission cu)
      const PermissionService = require('../../application/services/PermissionService');
      const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
      const ps = new PermissionService({ roleRepository: new RoleRepositoryImpl() });
      const permissions = await ps.getUserPermissions(userId, { skipCache: true });
      const permissionKeys = Array.from(permissions);

      const newToken = jwt.sign(
        {
          userId,
          email: req.user.email,
          name: req.user.name,
          roles: roleNames,
          permissions: permissionKeys,
          branchId: req.user.branchId,
          tokenVersion: req.user.tokenVersion,
          ...(req.user.deviceId ? { deviceId: req.user.deviceId } : {}),
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      return success(res, { token: newToken, roles: roleNames, permissions: permissionKeys }, 'Cap lai token thanh cong');
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/admin/refresh-permissions
   * Lay permissions moi nhat tu DB va tra ve token moi.
   * Dung khi admin vua sua ma tran quyen — can cap nhat token de
   * permission thay doi co hieu luc ngay lap tuc.
   */
  refreshPermissions = async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new (require('../../utils/ApiError'))(401, 'Token khong hop le'));
      }

      const roles = await this.userRoleService.getUserRoles(userId);
      const roleNames = roles.map((r) => r.roleName).filter(Boolean);

      // JWT: compact (tránh 431). Response permissions: full L2 cho FE UI.
      const PermissionService = require('../../application/services/PermissionService');
      const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
      const ps = new PermissionService({ roleRepository: new RoleRepositoryImpl() });
      const compactKeys = await ps.getUserPermissionsCompact(userId, { skipCache: true });
      const fullKeys = Array.from(await ps.getUserPermissions(userId, { skipCache: true }));

      const newToken = jwt.sign(
        {
          userId,
          email: req.user.email,
          name: req.user.name,
          roles: roleNames,
          permissions: compactKeys,
          branchId: req.user.branchId,
          tokenVersion: req.user.tokenVersion,
          ...(req.user.deviceId ? { deviceId: req.user.deviceId } : {}),
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      return success(
        res,
        { token: newToken, permissions: fullKeys, effectivePermissions: fullKeys },
        'Cap nhat quyen thanh cong'
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/admin/debug-permissions
   * Tra ve THÔNG TIN DEBUG về permissions từ JWT hiện tại và từ DB.
   * Endpoint này KHÔNG bị cache, luôn query DB mới nhất.
   * Dùng để debug khi FE PermissionGate không hiển thị nút.
   */
  debugPermissions = async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new (require('../../utils/ApiError'))(401, 'Token khong hop le'));
      }

      const { query } = require('../../infrastructure/database/sqlServer');

      // 1. Permissions từ JWT (trong req.user đã được auth middleware decode)
      const jwtPermissions = req.user?.permissions || [];

      // 2. Roles từ JWT
      const jwtRoles = req.user?.roles || [];

      // 3. Permissions từ DB (không cache - luôn query mới)
      const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
      const PermissionService = require('../../application/services/PermissionService');
      const roleRepo = new RoleRepositoryImpl();
      const permService = new PermissionService({ roleRepository: roleRepo });

      // Invalidate cache trước khi query
      permService.invalidateCache(userId);

      const dbPermissions = await permService.getUserPermissions(userId);
      const dbPermissionKeys = Array.from(dbPermissions);

      // 4. Kiểm tra user_role assignment
      const roleResult = await query(`
        SELECT r.role_name, ur.is_active
        FROM user_role ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = @p1
      `, { p1: userId });

      // 5. Kiểm tra role_permissions cho admin role
      const adminRoleResult = await query(`
        SELECT p.permission_key
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        JOIN roles r ON r.id = rp.role_id
        WHERE r.role_name = 'admin'
        AND p.permission_key LIKE 'admin:branches:%'
      `);

      return success(res, {
        userId,
        jwt: {
          roles: jwtRoles,
          permissions: jwtPermissions,
          hasAdminBranchesCreate: jwtPermissions.includes('admin:branches:create'),
        },
        database: {
          permissions: dbPermissionKeys,
          hasAdminBranchesCreate: dbPermissionKeys.includes('admin:branches:create'),
        },
        userRoleAssignments: roleResult.recordset,
        adminRoleBranchesPermissions: adminRoleResult.recordset.map(r => r.permission_key),
      }, 'Debug permissions info');
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/admin/sessions/cleanup
   * Don dep cac session trung lap: chi giu lai session moi nhat cho moi user.
   * Dung de xu ly cac session active trung lap trong database.
   */
  cleanupDuplicateSessions = async (req, res, next) => {
    try {
      const { query } = require('../../infrastructure/database/sqlServer');

      // Tim va dong cac session trung lap, chi giu lai session moi nhat
      const result = await query(`
        WITH RankedSessions AS (
          SELECT 
            id,
            user_id,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_time DESC) as rn
          FROM login_sessions
          WHERE status = 'active' AND action_type = 'LOGIN'
        )
        UPDATE login_sessions
        SET status = 'ended', 
            logout_reason = 'SESSION_CLEANUP',
            logout_time = SYSUTCDATETIME(),
            session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME())
        WHERE id IN (
          SELECT id FROM RankedSessions WHERE rn > 1
        );
        SELECT @@ROWCOUNT as closedSessions;
      `);

      const closedSessions = result.recordset?.[0]?.closedSessions || 0;

      // Xoa device cu trung lap (chi giu device moi nhat)
      await query(`
        WITH RankedDevices AS (
          SELECT 
            id,
            user_id,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY last_login_at DESC) as rn
          FROM user_devices
          WHERE is_current = 1
        )
        UPDATE user_devices
        SET is_current = 0
        WHERE id IN (
          SELECT id FROM RankedDevices WHERE rn > 1
        );
      `);

      return success(res, {
        closedSessions,
        message: closedSessions > 0
          ? `Da dong ${closedSessions} session trung lap`
          : 'Khong co session trung lap',
      }, 'Don dep session thanh cong');
    } catch (err) {
      next(err);
    }
  };

  // ============================================================
  // PERMISSION GROUPS (Phase 3)
  // ============================================================

  listPermissionGroups = async (req, res, next) => {
    try {
      const result = await this.permissionGroupService.listGroups();
      return success(res, result, 'Danh sach nhom quyen');
    } catch (err) {
      next(err);
    }
  };

  getPermissionGroupDetail = async (req, res, next) => {
    try {
      const group = await this.permissionGroupService.getGroupDetail(req.params.id);
      return success(res, group, 'Chi tiet nhom quyen');
    } catch (err) {
      next(err);
    }
  };

  getRoleGroupIds = async (req, res, next) => {
    try {
      const result = await this.permissionGroupService.getRoleGroupIds(req.params.id);
      return success(res, result, 'Danh sach nhom quyen cua vai tro');
    } catch (err) {
      next(err);
    }
  };

  setRoleGroups = async (req, res, next) => {
    try {
      const { groupIds } = req.body;
      const result = await this.permissionGroupService.setRoleGroups(
        req.params.id,
        Array.isArray(groupIds) ? groupIds : [],
        req
      );
      return success(res, result, 'Cap nhat nhom quyen cho vai tro thanh cong');
    } catch (err) {
      next(err);
    }
  };

  setRoleGroupsMatrix = async (req, res, next) => {
    try {
      const { changes } = req.body;
      const result = await this.permissionGroupService.setRoleGroupsMatrix({ changes }, req);
      await auditCrud.update(req, {
        tableName: 'role_permissions',
        entityCode: 'MATRIX',
        entityName: 'Ma tran nhom quyen',
        newData: { roleCount: result.updatedRoles },
        description: `Cap nhat ma tran nhom quyen (${result.updatedRoles} vai tro, ${result.affectedUserCount} user bi anh huong)`,
      });
      return success(res, result, 'Cap nhat ma tran nhom quyen thanh cong');
    } catch (err) {
      next(err);
    }
  };

  // ── Vehicle brands ───────────────────────────────────────────────
  listVehicleBrands = async (req, res, next) => {
    try {
      const items = await this.vehicleBrandRepository.list({ includeInactive: true });
      return success(res, { items, total: items.length }, 'Danh sach hang xe');
    } catch (err) {
      next(err);
    }
  };

  createVehicleBrand = async (req, res, next) => {
    try {
      const ApiError = require('../../utils/ApiError');
      const brandName = String(req.body?.brandName || '').trim();
      if (!brandName) {
        throw new ApiError(400, 'Ten hang xe la bat buoc');
      }
      const warrantyYears = Number(req.body?.warrantyYears);
      const warrantyKm = Number(req.body?.warrantyKm);
      if (!Number.isFinite(warrantyYears) || warrantyYears < 0 || warrantyYears > 100) {
        throw new ApiError(400, 'So nam bao hanh phai tu 0 den 100');
      }
      if (!Number.isFinite(warrantyKm) || warrantyKm < 0) {
        throw new ApiError(400, 'So km bao hanh phai >= 0');
      }
      const brandCode = req.body?.brandCode != null
        ? String(req.body.brandCode).trim()
        : undefined;
      const brand = await this.vehicleBrandRepository.create({
        brandName,
        brandCode: brandCode || undefined,
        warrantyYears,
        warrantyKm,
      });
      await auditCrud.create(req, {
        tableName: 'brands',
        entityCode: brand.brandCode || brand.brandName,
        recordId: brand.id,
        entityName: 'Hãng xe',
        data: brand,
      });
      return success(res, brand, 'Tao hang xe thanh cong');
    } catch (err) {
      next(err);
    }
  };

  updateVehicleBrand = async (req, res, next) => {
    try {
      const ApiError = require('../../utils/ApiError');
      const patch = {};
      if (req.body?.brandName != null) {
        const brandName = String(req.body.brandName).trim();
        if (!brandName) throw new ApiError(400, 'Ten hang xe khong duoc rong');
        patch.brandName = brandName;
      }
      if (req.body?.brandCode != null) {
        patch.brandCode = String(req.body.brandCode).trim();
      }
      if (req.body?.warrantyYears !== undefined) {
        const warrantyYears = Number(req.body.warrantyYears);
        if (!Number.isFinite(warrantyYears) || warrantyYears < 0 || warrantyYears > 100) {
          throw new ApiError(400, 'So nam bao hanh phai tu 0 den 100');
        }
        patch.warrantyYears = warrantyYears;
      }
      if (req.body?.warrantyKm !== undefined) {
        const warrantyKm = Number(req.body.warrantyKm);
        if (!Number.isFinite(warrantyKm) || warrantyKm < 0) {
          throw new ApiError(400, 'So km bao hanh phai >= 0');
        }
        patch.warrantyKm = warrantyKm;
      }
      const brand = await this.vehicleBrandRepository.update(req.params.id, patch);
      if (!brand) {
        throw new ApiError(404, 'Hang xe khong ton tai');
      }
      await auditCrud.update(req, {
        tableName: 'brands',
        entityCode: brand?.brandCode || brand?.brandName,
        recordId: req.params.id,
        entityName: 'Hãng xe',
        newData: req.body,
      });
      return success(res, brand, 'Cap nhat hang xe thanh cong');
    } catch (err) {
      next(err);
    }
  };

  toggleVehicleBrandStatus = async (req, res, next) => {
    try {
      const brand = await this.vehicleBrandRepository.toggleStatus(req.params.id);
      await auditCrud.update(req, {
        tableName: 'brands',
        entityCode: brand?.brandName,
        recordId: req.params.id,
        entityName: 'Hãng xe',
        newData: { isActive: brand?.isActive },
      });
      return success(res, brand, 'Cap nhat trang thai hang xe thanh cong');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AdminController;
