const ApiError = require('../../utils/ApiError');
const { query } = require('../../infrastructure/database/sqlServer');
const UserScreenPermissionsRepository = require('../../infrastructure/repositories/UserScreenPermissionsRepository');
const RoleScreenMatrixRepository = require('../../infrastructure/repositories/RoleScreenMatrixRepository');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const UserRepositoryImpl = require('../../infrastructure/repositories/UserRepositoryImpl');
const UserRoleRepositoryImpl = require('../../infrastructure/repositories/UserRoleRepositoryImpl');
const AuditService = require('../../application/services/AuditService');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const PermissionService = require('../../application/services/PermissionService');
const { emitPermissionChanged } = require('../../application/events/PermissionEvents');
const { generatePermissionKeys } = require('../../../scripts/auto-discover-permissions');

/**
 * UserScreenPermissionsController - quan ly quyen truy cap rieng cho user (override).
 *
 * GET  /api/admin/users/:userId/screen-permissions
 *   -> { user, screens, overrides, generatedAt }
 *   Tra ve danh sach screen (auto-discovered) + override hien tai cua user.
 *
 * PUT  /api/admin/users/:userId/screen-permissions
 *   body: { items: [{ screenKey, canView, canCreate, canUpdate, canDelete, canExport, overrideType, note }] }
 *   -> Bulk replace override, invalidate cache, emit SSE.
 *
 * DELETE /api/admin/users/:userId/screen-permissions
 *   -> Xoa het override, user quay ve dung role_screen_permissions.
 *
 * GET /api/admin/users/:userId/screen-permissions/effective
 *   -> Tra ve danh sach permission flat (sau khi merge role + override) - dung de debug.
 */
class UserScreenPermissionsController {
  constructor() {
    this.repo = new UserScreenPermissionsRepository();
    this.matrixRepo = new RoleScreenMatrixRepository();
    this.roleRepo = new RoleRepositoryImpl();
    this.userRepo = new UserRepositoryImpl();
    this.userRoleRepo = new UserRoleRepositoryImpl();
    this.auditService = new AuditService(AuditRepository);
    this.permissionService = new PermissionService({ roleRepository: this.roleRepo });
  }

  _buildScreensMap = async () => {
    // 1) Lay tu screen_routes table (co metadata chuan: label, group, sort, role_prefix)
    const dbScreens = await query(
      `SELECT screen_key, screen_label, group_label, role_prefix, sort_order
       FROM screen_routes
       WHERE is_active = 1
       ORDER BY ISNULL(group_label, 'zzz'), ISNULL(sort_order, 9999), screen_key`
    );
    const screensMap = new Map();
    for (const row of dbScreens.recordset) {
      const key = row.screen_key;
      screensMap.set(key, {
        screenKey: key,
        screenLabel: row.screen_label,
        groupLabel: row.group_label,
        rolePrefix: row.role_prefix,
        sortOrder: row.sort_order,
        module: key.split(':')[0],
        resource: key.split(':')[1] || key,
      });
    }

    // 2) Auto-discover tu routes (them nhung screen co trong code nhung chua co trong screen_routes)
    const perms = generatePermissionKeys();
    for (const p of perms) {
      const key = `${p.module}:${p.resource}`;
      if (!screensMap.has(key)) {
        screensMap.set(key, {
          screenKey: key,
          screenLabel: null,
          groupLabel: null,
          rolePrefix: p.module,
          sortOrder: 9999,
          module: p.module,
          resource: p.resource,
        });
      }
    }

    return Array.from(screensMap.values()).sort((a, b) => {
      // 1) group_label (null xep cuoi)
      const gA = (a.groupLabel || 'zzz').toLowerCase();
      const gB = (b.groupLabel || 'zzz').toLowerCase();
      if (gA !== gB) return gA.localeCompare(gB);
      // 2) sort_order
      if (a.sortOrder !== b.sortOrder) return (a.sortOrder || 9999) - (b.sortOrder || 9999);
      // 3) screen_key
      return a.screenKey.localeCompare(b.screenKey);
    });
  };

  getUserOverrides = async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) throw new ApiError(400, 'userId la bat buoc');

      const user = await this.userRepo.findById(userId);
      if (!user) throw new ApiError(404, 'User khong ton tai');

      const overrideMap = await this.repo.getByUser(userId);
      const screens = await this._buildScreensMap();

      // Lay role-based matrix cua user (gom tu cac role)
      const userRoles = await this.userRoleRepo.findByUser(userId);
      const roleMatrix = new Map();
      for (const role of userRoles) {
        const m = await this.matrixRepo.getMatrixByRole(role.roleId);
        for (const [key, bits] of m.entries()) {
          const existing = roleMatrix.get(key) || {
            canView: false, canCreate: false, canUpdate: false, canDelete: false, canExport: false,
          };
          roleMatrix.set(key, {
            canView: existing.canView || bits.canView,
            canCreate: existing.canCreate || bits.canCreate,
            canUpdate: existing.canUpdate || bits.canUpdate,
            canDelete: existing.canDelete || bits.canDelete,
            canExport: existing.canExport || bits.canExport,
          });
        }
      }

      const userRoleIds = userRoles.map((r) => r.roleId);

      const overrideItems = Array.from(overrideMap.entries()).map(([screenKey, bits]) => ({
        screenKey,
        canView: bits.canView,
        canCreate: bits.canCreate,
        canUpdate: bits.canUpdate,
        canDelete: bits.canDelete,
        canExport: bits.canExport,
        overrideType: bits.overrideType,
        note: bits.note,
      }));

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name,
            status: user.status,
          },
          userRoles: userRoles.map((r) => ({
            id: r.roleId,
            roleName: r.roleName,
            roleLabel: r.roleLabel,
          })),
          userRoleIds,
          screens,
          roleMatrix: Array.from(roleMatrix.entries()).map(([k, v]) => ({ screenKey: k, ...v })),
          overrides: overrideItems,
          generatedAt: new Date().toISOString(),
        },
        message: 'User screen permissions',
      });
    } catch (err) {
      next(err);
    }
  };

  saveUserOverrides = async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) throw new ApiError(400, 'userId la bat buoc');

      const user = await this.userRepo.findById(userId);
      if (!user) throw new ApiError(404, 'User khong ton tai');

      const { items } = req.body || {};
      if (!Array.isArray(items)) throw new ApiError(400, 'items phai la mang');

      const normalized = items.map((i) => ({
        screenKey: String(i.screenKey),
        canView: Boolean(i.canView),
        canCreate: Boolean(i.canCreate),
        canUpdate: Boolean(i.canUpdate),
        canDelete: Boolean(i.canDelete),
        canExport: Boolean(i.canExport),
        overrideType: ['grant', 'deny', 'full'].includes(i.overrideType) ? i.overrideType : 'full',
        note: i.note || null,
      }));

      const result = await this.repo.bulkReplace(userId, normalized, req.user?.userId);

      // Invalidate cache + emit SSE
      this.permissionService.invalidateAllCache();
      try {
        emitPermissionChanged({
          action: 'user_screen_overrides_updated',
          userIds: [userId],
          roleIds: [],
          actorUserId: req.user?.userId || null,
          details: { count: normalized.length },
        });
      } catch (eventErr) {
        console.warn('[UserScreenPermissionsController] SSE emit failed:', eventErr.message);
      }

      // Audit
      try {
        await this.auditService.log({
          actorId: req.user?.userId,
          actorEmail: req.user?.email,
          action: 'SAVE_USER_SCREEN_PERMISSIONS',
          resource: 'user_screen_permissions',
          resourceId: String(userId),
          details: {
            targetEmail: user.email,
            itemCount: normalized.length,
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      } catch (auditErr) {
        console.warn('[UserScreenPermissionsController] audit log failed:', auditErr.message);
      }

      return res.json({
        success: true,
        data: { updated: result.updated },
        message: 'Da luu quyen truy cap rieng cho user',
      });
    } catch (err) {
      next(err);
    }
  };

  clearUserOverrides = async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) throw new ApiError(400, 'userId la bat buoc');

      const user = await this.userRepo.findById(userId);
      if (!user) throw new ApiError(404, 'User khong ton tai');

      const deleted = await this.repo.clearAll(userId);

      this.permissionService.invalidateAllCache();
      try {
        emitPermissionChanged({
          action: 'user_screen_overrides_cleared',
          userIds: [userId],
          roleIds: [],
          actorUserId: req.user?.userId || null,
          details: { deleted },
        });
      } catch (e) {
        console.warn('[UserScreenPermissionsController] SSE emit failed:', e.message);
      }

      return res.json({
        success: true,
        data: { deleted },
        message: 'Da xoa het override, user quay ve dung role',
      });
    } catch (err) {
      next(err);
    }
  };

  getEffectivePermissions = async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) throw new ApiError(400, 'userId la bat buoc');

      const perms = await this.repo.getUserScreenPermissions(userId);
      return res.json({
        success: true,
        data: { userId, permissions: perms, total: perms.length },
        message: 'Effective permissions (role + override)',
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = UserScreenPermissionsController;
