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

    this.auditService = new AuditService(AuditRepository);
    this.branchService = new BranchService();
    this.deviceService = new DeviceService();
    this.specialtyService = new SpecialtyService();
    this.securityAlertService = new SecurityAlertService();
    this.notificationService = new NotificationService();

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
    this.saveRolePermissionsMatrix = this.saveRolePermissionsMatrix.bind(this);
    this.getRoleUsers = this.getRoleUsers.bind(this);
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
      const { permissionIds } = req.body;
      // Validation chi tiet (loai bo NaN, check ton tai) lam trong RoleService.setRolePermissions
      const permissions = await this.roleService.setRolePermissions(
        req.params.id,
        Array.isArray(permissionIds) ? permissionIds : []
      );
      await auditCrud.update(req, {
        tableName: 'role_permissions',
        entityCode: `ID-${req.params.id}`,
        recordId: Number(req.params.id) || null,
        entityName: 'Phân quyền vai trò',
        newData: { permissionIds: Array.isArray(permissionIds) ? permissionIds : [] },
        description: `Cập nhật quyền cho vai trò ID ${req.params.id} (${permissions.length || 0} quyền)`,
      });
      return success(res, { items: permissions, total: permissions.length }, 'Cap nhat quyen vai tro thanh cong');
    } catch (err) {
      next(err);
    }
  };

  /**
   * Bulk save permissions cho nhieu role trong 1 transaction (atomic).
   * Body: { changes: [{roleId, permissionIds}, ...] }
   * Dung cho trang "Ma tran quyen" (Permission Matrix).
   * - 1 call duy nhat, khong N+1
   * - Last-admin guard trong service (khong cho tuoc het admin:roles:* cua role admin)
   * - Audit log + permission cache invalidation tu dong
   */
  saveRolePermissionsMatrix = async (req, res, next) => {
    try {
      const { changes } = req.body;
      const result = await this.roleService.setRolePermissionsMatrix({
        changes,
        actorUserId: req.user?.userId,
      });

      // Push SSE event de cac user bi anh huong tu refresh permission realtime
      // (FE nhan event -> goi getMeApi -> cap nhat token + permissions vao storage).
      // Bo qua neu khong co user nao bi anh huong (best-effort, khong fail request).
      try {
        const roleIds = (changes || []).map((c) => Number(c.roleId)).filter(Number.isFinite);
        emitPermissionChanged({
          action: 'matrix_updated',
          userIds: result.affectedUserIds || [],
          roleIds,
          actorUserId: req.user?.userId || null,
        });
      } catch (eventErr) {
        // Log nhung khong fail API - SSE chi la optional enhancement.
        console.warn('[AdminController] emitPermissionChanged failed:', eventErr.message);
      }

      await auditCrud.update(req, {
        tableName: 'role_permissions',
        entityCode: 'MATRIX',
        recordId: null,
        entityName: 'Ma trận quyền',
        newData: {
          changeCount: changes?.length || 0,
          invalidations: result.invalidations,
          affectedUserCount: (result.affectedUserIds || []).length,
        },
        description: `Cập nhật ma trận quyền (${changes?.length || 0} vai trò, ${result.invalidations} user bị ảnh hưởng cache)`,
      });
      return success(
        res,
        result,
        `Da luu ma tran quyen (${result.results.length} vai tro, ${result.invalidations} user invalidate cache)`
      );
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
      const { userId, search, browser, os, isCurrent, dateFrom, dateTo, page, pageSize } = req.query;
      const result = await this.deviceService.listAll({
        userId,
        search,
        browser,
        os,
        isCurrent,
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
      const alert = await this.securityAlertService.acknowledge(req.params.id, req.user?.userId);
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
      const { userId, firstName, lastName, email, phone, status, roleId, branchId, scopeAllBranches } = req.body;
      console.log('[AdminController] updateUser - req.body:', JSON.stringify(req.body));
      const oldData = {};
      if (userId) {
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
      }
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
        recordId: updated?.id || Number(userId) || null,
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

      const mustChangePassword = req.body?.mustChangePassword !== false;
      const newPassword = req.body?.newPassword;

      const result = await this.adminUserService.resetPassword({
        userId: targetUserId,
        mustChangePassword,
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

      // Lay permissions tu DB
      const PermissionService = require('../../application/services/PermissionService');
      const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
      const ps = new PermissionService({ roleRepository: new RoleRepositoryImpl() });
      const permissions = await ps.getUserPermissions(userId);
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

      // Lay permissions tu DB (bypass cache de lay gia tri moi nhat)
      const PermissionService = require('../../application/services/PermissionService');
      const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
      const ps = new PermissionService({ roleRepository: new RoleRepositoryImpl() });
      const permissions = await ps.getUserPermissions(userId);
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

      return success(res, { token: newToken, permissions: permissionKeys }, 'Cap nhat quyen thanh cong');
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
}

module.exports = AdminController;
