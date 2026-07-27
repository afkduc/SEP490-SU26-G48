const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const { query } = require('../../infrastructure/database/sqlServer');
const PermissionMatrixRepository = require('../../infrastructure/repositories/PermissionMatrixRepository');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const RoleScreenMatrixRepository = require('../../infrastructure/repositories/RoleScreenMatrixRepository');
const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
const UserRepositoryImpl = require('../../infrastructure/repositories/UserRepositoryImpl');
const AuditService = require('../../application/services/AuditService');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const PermissionService = require('../../application/services/PermissionService');
const { emitPermissionChanged } = require('../../application/events/PermissionEvents');
const { generatePermissionKeys } = require('../../infrastructure/utils/autoDiscoverPermissions');


/**
 * PermissionMatrixController — admin-only endpoints de quan ly ma tran quyen
 * (Role x Screen).
 *
 * GET  /api/admin/permission-matrix
 *   -> tra ve { roles, screens, grants, generatedAt }
 *
 * PATCH /api/admin/permission-matrix
 *   body: { roleId, permissionId, granted: true|false }
 *   -> toggle 1 cell, audit log, invalidate permission cache cho tat ca user
 *
 * POST /api/admin/permission-matrix/bulk
 *   body: { cells: [{ roleId, permissionId, granted }, ...] }
 *   -> toggle nhieu cell trong 1 transaction
 */
class PermissionMatrixController {
  constructor() {
    this.repo = new PermissionMatrixRepository();
    this.roleScreenRepo = new RoleScreenMatrixRepository();
    this.auditService = new AuditService(AuditRepository);
    this.permissionService = new PermissionService({
      roleRepository: new RoleRepositoryImpl(),
    });
    this.authRepo = new AuthRepositoryImpl();
    this.userRepo = new UserRepositoryImpl();
  }

  getMatrix = async (req, res, next) => {
    try {
      const [roles, screens, grants, labelRows] = await Promise.all([
        this.repo.getRoles(),
        this.repo.getScreens(),
        this.repo.getGrants(),
        query(
          `SELECT screen_key, screen_label, group_label
           FROM screen_routes
           WHERE is_active = 1`
        ).catch(() => ({ recordset: [] })),
      ]);

      const screenLabels = {};
      for (const row of labelRows.recordset || []) {
        if (row.screen_key) {
          screenLabels[row.screen_key] = {
            screenLabel: row.screen_label || null,
            groupLabel: row.group_label || null,
          };
        }
      }

      // Build "screens by role" theo 2D matrix (screen x actions)
      // - Tra ve tat ca auto-discovered screens cho moi role (104+ screens).
      // - FE se filter theo scope (L1 access + L2 bits) de chi hien thi screens
      //   lien quan den role do.
      // - Moi screen co hasAccess (L1) + 5 action bits (L2).
      const screensByRole = {};
      // L2 screen_keys per role (de FE derive scope day du)
      const roleScreenKeys = {};
      for (const role of roles) {
        screensByRole[role.id] = await this.buildScreenPermissionsForRole(role, screenLabels);
        // Lay danh sach screen_key (module:resource) tu role_screen_permissions
        const l2Matrix = await this.roleScreenRepo.getMatrixByRole(role.id);
        roleScreenKeys[role.id] = Array.from(l2Matrix.keys());
      }

      return success(res, {
        roles,
        screens,
        grants,
        screensByRole,
        roleScreenKeys,
        screenLabels,
        generatedAt: new Date().toISOString(),
      }, 'Ma tran quyen (role x screen)');
    } catch (err) {
      next(err);
    }
  };

  /**
   * Build 2D matrix (screen x actions) cho 1 role.
   *
   * Tra ve TAT CA auto-discovered screens (from routes/*.js) kem theo:
   *   - hasAccess: role co L1 "screen:<X>:<Y>:access" tu permissions table
   *   - canView/canCreate/canUpdate/canDelete/canExport: 5 action bits tu role_screen_permissions
   *   - availableActions: action nao co route that (auto-discovered)
   *
   * FE tu filter theo scope:
   *   - Role thuong: chi hien thi screens co hasAccess || hasAnyAction.
   *   - Admin: hien thi tat ca.
   */
  buildScreenPermissionsForRole = async (role, screenLabels = {}) => {
    const roleId = role.id;

    // L1 grants cho role (permissions table)
    const allGrants = await this.repo.getGrants();
    const l1Keys = new Set(
      allGrants
        .filter((g) => g.roleId === roleId && g.layer === 1 && g.permissionKey.startsWith('screen:'))
        .map((g) => g.permissionKey)
    );

    // L2 grants cho role (role_screen_permissions)
    const l2Matrix = await this.roleScreenRepo.getMatrixByRole(roleId);

    // Auto-discover: availableActions cho moi (module:resource)
    const perms = generatePermissionKeys();
    const screensMap = new Map();
    for (const p of perms) {
      const key = `${p.module}:${p.resource}`;
      if (!screensMap.has(key)) {
        const meta = screenLabels[key] || {};
        screensMap.set(key, {
          screenKey: key,
          screenLabel: meta.screenLabel || null,
          groupLabel: meta.groupLabel || null,
          module: p.module,
          resource: p.resource,
          accessKey: `screen:${p.module}:${p.resource}:access`,
          availableActions: {
            view: false, create: false, update: false, delete: false, export: false,
          },
        });
      }
      const a = screensMap.get(key).availableActions;
      if (p.action === 'read') a.view = true;
      if (p.action === 'create') a.create = true;
      if (p.action === 'update') a.update = true;
      if (p.action === 'delete') a.delete = true;
      if (p.action === 'export') a.export = true;
    }

    // QUAN TRONG: them L2 screen_keys (tu role_screen_permissions) vao screensMap.
    // Vi cac module advisor/director/leader/technician KHONG co routes file
    // (advisorRoutes.js, ...), auto-discover khong tao entry cho chung.
    // Neu chi de auto-discover lam whitelist, 3 roles nay se khong thay screen nao.
    if (l2Matrix && l2Matrix.size > 0) {
      for (const screenKey of l2Matrix.keys()) {
        if (!screensMap.has(screenKey)) {
          const parts = screenKey.split(':');
          const m = parts[0];
          const r = parts.slice(1).join(':') || '';
          const meta = screenLabels[screenKey] || {};
          screensMap.set(screenKey, {
            screenKey,
            screenLabel: meta.screenLabel || null,
            groupLabel: meta.groupLabel || null,
            module: m,
            resource: r,
            accessKey: `screen:${m}:${r}:access`,
            availableActions: {
              view: true, create: true, update: true, delete: true, export: true,
            },
          });
        } else if (!screensMap.get(screenKey).screenLabel && screenLabels[screenKey]?.screenLabel) {
          screensMap.get(screenKey).screenLabel = screenLabels[screenKey].screenLabel;
          screensMap.get(screenKey).groupLabel = screenLabels[screenKey].groupLabel || null;
        }
      }
    }

    // Map sang response: hasAccess + 5 action bits
    const screens = Array.from(screensMap.values()).map((s) => {
      const l2 = l2Matrix.get(s.screenKey);
      const meta = screenLabels[s.screenKey] || {};
      return {
        ...s,
        screenLabel: s.screenLabel || meta.screenLabel || null,
        groupLabel: s.groupLabel || meta.groupLabel || null,
        hasAccess: l1Keys.has(s.accessKey),
        canView: l2 ? Boolean(l2.canView) : false,
        canCreate: l2 ? Boolean(l2.canCreate) : false,
        canUpdate: l2 ? Boolean(l2.canUpdate) : false,
        canDelete: l2 ? Boolean(l2.canDelete) : false,
        canExport: l2 ? Boolean(l2.canExport) : false,
      };
    });

    return screens.sort((a, b) => a.screenKey.localeCompare(b.screenKey));
  };

  toggleCell = async (req, res, next) => {
    try {
      const { roleId, permissionKey, permissionId, granted } = req.body || {};
      if (!roleId || (!permissionKey && !permissionId) || typeof granted !== 'boolean') {
        throw new ApiError(400, 'Thieu roleId/permissionKey(permissionId)/granted');
      }

      // Khong cho phep revoke permission '*' cua admin (bao ve an toan).
      if (!granted && (permissionKey === '*' || permissionId === 565)) {
        const roles = await this.repo.getRoles();
        const role = roles.find((r) => r.id === roleId);
        if (role && role.roleName === 'admin') {
          throw new ApiError(409, 'Khong the thu hoi wildcard "*" cua admin role.');
        }
      }

      // Uu tien permissionKey (string) - stable identifier
      let result;
      if (permissionKey) {
        result = await this.repo.toggleGrantByKey(roleId, permissionKey, granted);
      } else {
        // Backward compat: permissionId (L1 + L2b id am)
        result = await this.repo.toggleGrantLayered(roleId, permissionId, granted);
      }
      const changed = result?.changed === true;

      // Invalidate cache toan bo user de permission moi co hieu luc ngay.
      this.permissionService.invalidateAllCache();

      // Emit SSE + thu thap affectedUserIds (khai bao ngoai try de dung cho audit/notify)
      let affectedUserIds = [];
      try {
        affectedUserIds = await this.repo.getUsersByRole(roleId);
        if (affectedUserIds.length > 0) {
          emitPermissionChanged({
            action: 'matrix_updated',
            userIds: affectedUserIds,
            roleIds: [roleId],
            actorUserId: req.user?.userId || null,
            details: { permissionKey: permissionKey || null, permissionId: permissionId || null, granted },
          });

          // Bump token_version cho user bi anh huong -> JWT cu vo hieu luc -> user
          // se bi 401 o request tiep theo -> SessionExpiredModal hien -> user login
          // lai de nhan quyen moi. Day dam bao user khong the giu quyen cu qua
          // session JWT khi admin vua revoke.
          if (!granted) {
            await this._bumpTokenVersions(affectedUserIds, req);
          }
        }
      } catch (eventErr) {
        // Log nhung khong fail API - SSE chi la optional enhancement.
        console.warn('[PermissionMatrixController] emit SSE failed:', eventErr.message);
      }

      // Audit log + notification (theo yeu cau "cứ ghi log là thông báo")
      try {
        const actorName = req.user?.name || req.user?.email || 'Quản trị viên';
        const permLabel = permissionKey || `id:${permissionId}`;
        await this.auditService.log({
          actorId: req.user?.userId,
          actorEmail: req.user?.email,
          action: granted ? 'GRANT_SCREEN' : 'REVOKE_SCREEN',
          resource: 'permission_matrix',
          resourceId: `${roleId}_${permissionKey || permissionId}`,
          details: { roleId, permissionId, permissionKey, granted, changed },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        const NotificationService = require('../../application/services/NotificationService');
        const ns = new NotificationService();

        // Thong bao admin (ma tran doi)
        await ns.notifyAdmins('PERMISSION_MATRIX_UPDATED', {
          actorName,
          permissionKey: `${granted ? 'Cấp' : 'Thu hồi'} ${permLabel}`,
          actorId: req.user?.userId,
        }, { excludeUserId: req.user?.userId }).catch((err) =>
          console.warn('[PermissionMatrix] notifyAdmins failed:', err.message),
        );

        // Thong bao user bi anh huong
        for (const userId of affectedUserIds) {
          if (granted) {
            await ns.notify('PERMISSION_GRANTED', {
              userId,
              permissionKey: permLabel,
              fromMatrix: true,
              actorName,
              actorId: req.user?.userId,
            }, { skipSettings: true }).catch((err) =>
              console.warn('[PermissionMatrix] notify user failed:', err.message),
            );
          } else {
            await ns.notify('ROLE_CHANGED', {
              userId,
              roles: `Thu hồi ${permLabel}`,
              action: 'REVOKED',
              actorName,
              actorId: req.user?.userId,
            }, { skipSettings: true }).catch((err) =>
              console.warn('[PermissionMatrix] notify user failed:', err.message),
            );
          }
        }
      } catch (auditErr) {
        console.warn('[PermissionMatrixController] audit log failed (non-blocking):', auditErr.message);
      }

      return success(res, { changed }, changed ? 'Da cap nhat' : 'Khong co thay doi');
    } catch (err) {
      next(err);
    }
  };

  bulkToggle = async (req, res, next) => {
    try {
      const { cells } = req.body || {};
      if (!Array.isArray(cells) || cells.length === 0) {
        throw new ApiError(400, 'cells phai la mang khong rong');
      }
      if (cells.length > 500) {
        throw new ApiError(400, 'cells qua lon (max 500)');
      }

      const results = [];
      const affectedRoleIds = new Set();
      for (const c of cells) {
        if (!c || !c.roleId || (!c.permissionKey && !c.permissionId) || typeof c.granted !== 'boolean') {
          results.push({ ...c, ok: false, reason: 'invalid' });
          continue;
        }
        let changed = false;
        try {
          if (c.permissionKey) {
            const r = await this.repo.toggleGrantByKey(c.roleId, c.permissionKey, c.granted);
            changed = r?.changed === true;
          } else {
            changed = await this.repo.toggleGrantLayered(c.roleId, c.permissionId, c.granted);
          }
        } catch (cellErr) {
          results.push({ ...c, ok: false, reason: cellErr.message });
          continue;
        }
        results.push({ ...c, ok: true, changed });
        affectedRoleIds.add(Number(c.roleId));
      }

      this.permissionService.invalidateAllCache();

      // Emit SSE den tat ca user dang giu cac role bi thay doi.
      // Chi emit 1 lan voi union userIds de tranh spam.
      let affectedUserCount = 0;
      let affectedUserIds = [];
      try {
        if (affectedRoleIds.size > 0) {
          const userSet = new Set();
          const grantedByRole = new Map();
          for (const cell of cells) {
            if (cell && cell.roleId && typeof cell.granted === 'boolean') {
              if (!grantedByRole.has(Number(cell.roleId))) {
                grantedByRole.set(Number(cell.roleId), cell.granted);
              }
            }
          }
          for (const rid of affectedRoleIds) {
            const users = await this.repo.getUsersByRole(rid);
            users.forEach((u) => userSet.add(u));
          }
          affectedUserIds = [...userSet];
          affectedUserCount = affectedUserIds.length;
          if (affectedUserCount > 0) {
            emitPermissionChanged({
              action: 'matrix_updated',
              userIds: affectedUserIds,
              roleIds: [...affectedRoleIds],
              actorUserId: req.user?.userId || null,
              details: { count: cells.length },
            });

            // Chi revoke (granted=false) moi can bump token_version.
            // Neu bat ky cell nao trong bulk la revoke, user phai login lai.
            const hasRevoke = [...grantedByRole.values()].some((g) => g === false);
            if (hasRevoke) {
              await this._bumpTokenVersions(affectedUserIds, req);
            }
          }
        }
      } catch (eventErr) {
        console.warn('[PermissionMatrixController] emit SSE (bulk) failed:', eventErr.message);
      }

      // Audit log + notify
      try {
        const actorName = req.user?.name || req.user?.email || 'Quản trị viên';
        await this.auditService.log({
          actorId: req.user?.userId,
          actorEmail: req.user?.email,
          action: 'BULK_TOGGLE',
          resource: 'permission_matrix',
          resourceId: 'bulk',
          details: { count: cells.length, affectedUserCount },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        const NotificationService = require('../../application/services/NotificationService');
        const ns = new NotificationService();
        await ns.notifyAdmins('PERMISSION_MATRIX_UPDATED', {
          actorName,
          bulk: true,
          count: cells.length,
          permissionKey: `${cells.length} ô`,
          actorId: req.user?.userId,
        }, { excludeUserId: req.user?.userId }).catch((err) =>
          console.warn('[PermissionMatrix] bulk notifyAdmins failed:', err.message),
        );

        for (const userId of affectedUserIds) {
          await ns.notify('ROLE_CHANGED', {
            userId,
            roles: `Cập nhật hàng loạt ma trận quyền (${cells.length} ô)`,
            actorName,
            actorId: req.user?.userId,
          }, { skipSettings: true }).catch((err) =>
            console.warn('[PermissionMatrix] bulk notify user failed:', err.message),
          );
        }
      } catch (auditErr) {
        console.warn('[PermissionMatrixController] audit log (bulk) failed (non-blocking):', auditErr.message);
      }

      return success(
        res,
        { results, affectedUserCount, affectedRoleCount: affectedRoleIds.size },
        'Da cap nhat hang loat'
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * Bump token_version cho 1 danh sach userId -> JWT cu cua ho vo hieu luc.
   * Moi user trong danh sach se nhan 401 o request tiep theo -> SessionExpiredModal
   * hien -> user phai login lai de nhan quyen moi.
   *
   * @param {number[]} userIds
   * @param {object} req - request object (de lay actor info cho audit)
   */
  _bumpTokenVersions = async (userIds, req) => {
    if (!Array.isArray(userIds) || userIds.length === 0) return;
    const actorId = req.user?.userId;
    const actorEmail = req.user?.email;
    for (const userId of userIds) {
      try {
        // Skip actor (admin dang thao tac) de khong tu logout minh
        if (Number(userId) === Number(actorId)) continue;
        await this.authRepo.incrementTokenVersion(userId);
      } catch (err) {
        console.warn(`[PermissionMatrixController] bump token_version cho user ${userId} failed:`, err.message);
      }
    }
  };
}

module.exports = PermissionMatrixController;