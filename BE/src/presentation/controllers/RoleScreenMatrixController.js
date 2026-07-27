const ApiError = require('../../utils/ApiError');
const RoleScreenMatrixRepository = require('../../infrastructure/repositories/RoleScreenMatrixRepository');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
const AuditService = require('../../application/services/AuditService');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const PermissionService = require('../../application/services/PermissionService');
const { emitPermissionChanged } = require('../../application/events/PermissionEvents');
const { generatePermissionKeys } = require('../../infrastructure/utils/autoDiscoverPermissions');

const PROTECTED_ROLES = new Set(['admin']);

/**
 * RoleScreenMatrixController - quan ly ma tran screen x action cho role.
 *
 * GET  /api/admin/role-screen-matrix?roleId=1
 *   -> { role, screenKeys, grants, generatedAt }
 *
 * PUT  /api/admin/role-screen-matrix?roleId=1
 *   body: { items: [{ screenKey, canView, canCreate, canUpdate, canDelete, canExport }] }
 *   -> Bulk upsert trong 1 transaction, invalidate cache, emit SSE,
 *      auto-sync L1 (screen:module:resource:access) theo L2.
 *
 * GET  /api/admin/role-screen-matrix/screens
 *   -> { screens: [...] } - danh sach screen_key (auto-discovered)
 *
 * GET  /api/admin/role-screen-matrix/compare?roleIds=1,2,3
 *   -> So sanh matrix giua nhieu role (de view/compare).
 */
class RoleScreenMatrixController {
  constructor() {
    this.repo = new RoleScreenMatrixRepository();
    this.roleRepo = new RoleRepositoryImpl();
    this.authRepo = new AuthRepositoryImpl();
    this.auditService = new AuditService(AuditRepository);
    this.permissionService = new PermissionService({
      roleRepository: this.roleRepo,
    });
  }

  /**
   * Lay danh sach screen_key (auto-discover tu routes).
   * Tra ve unique sorted list.
   */
  getAvailableScreens = async (req, res, next) => {
    try {
      const perms = generatePermissionKeys();
      const screensMap = new Map();
      for (const p of perms) {
        const key = `${p.module}:${p.resource}`;
        if (!screensMap.has(key)) {
          screensMap.set(key, {
            screenKey: key,
            module: p.module,
            resource: p.resource,
            methods: [],
          });
        }
        screensMap.get(key).methods.push(p.method);
      }
      const screens = Array.from(screensMap.values()).sort((a, b) =>
        a.screenKey.localeCompare(b.screenKey)
      );
      return res.json({
        success: true,
        data: { screens, total: screens.length },
        message: 'Danh sach screen tu auto-discover',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lay matrix cho 1 role.
   */
  getMatrix = async (req, res, next) => {
    try {
      const roleId = Number(req.query.roleId);
      if (!roleId) throw new ApiError(400, 'roleId la bat buoc');

      const role = await this.roleRepo.findById(roleId);
      if (!role) throw new ApiError(404, 'Role khong ton tai');

      const matrix = await this.repo.getMatrixByRole(roleId);

      // Lay available screens tu auto-discover + DB (gop ca 2 nguon de hien thi full matrix)
      const perms = generatePermissionKeys();
      const screensMap = new Map();
      for (const p of perms) {
        const key = `${p.module}:${p.resource}`;
        if (!screensMap.has(key)) {
          screensMap.set(key, {
            screenKey: key,
            module: p.module,
            resource: p.resource,
            // Track which actions have routes (auto-discovered)
            availableView: false,
            availableCreate: false,
            availableUpdate: false,
            availableDelete: false,
          });
        }
        const s = screensMap.get(key);
        if (p.action === 'read') s.availableView = true;
        if (p.action === 'create') s.availableCreate = true;
        if (p.action === 'update') s.availableUpdate = true;
        if (p.action === 'delete') s.availableDelete = true;
      }

      // BUOC QUAN TRONG: them ca nhung screen_keys co trong DB ma auto-discover khong co
      // (vd: manager:services, director:reports - business-specific).
      for (const [screenKey, granted] of matrix.entries()) {
        if (!screensMap.has(screenKey)) {
          // Tao module/resource tu screenKey (vd "manager:services" -> module=manager, resource=services)
          const parts = screenKey.split(':');
          screensMap.set(screenKey, {
            screenKey,
            module: parts[0] || 'custom',
            resource: parts.slice(1).join(':') || 'custom',
            // Business screens trong DB: cho cấu hình đủ 5 bit L2
            availableView: true,
            availableCreate: true,
            availableUpdate: true,
            availableDelete: true,
          });
        }
      }

      // Apply existing grants (DIRECT ASSIGNMENT - khong AND voi available)
      const screens = Array.from(screensMap.values()).map((s) => {
        const granted = matrix.get(s.screenKey);
        return {
          ...s,
          canView: granted ? Boolean(granted.canView) : false,
          canCreate: granted ? Boolean(granted.canCreate) : false,
          canUpdate: granted ? Boolean(granted.canUpdate) : false,
          canDelete: granted ? Boolean(granted.canDelete) : false,
          canExport: granted ? Boolean(granted.canExport) : false,
        };
      }).sort((a, b) => a.screenKey.localeCompare(b.screenKey));

      return res.json({
        success: true,
        data: {
          role: { id: role.id, roleName: role.roleName, roleLabel: role.roleLabel },
          screens,
          generatedAt: new Date().toISOString(),
        },
        message: 'Ma tran screen x action',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Bulk upsert matrix cho 1 role.
   *
   * Sau khi save L2, tu dong sync L1 (screen:module:resource:access):
   *   - it nhat 1 action true  -> L1 = grant
   *   - tat ca action false    -> L1 = revoke
   *
   * Dam bao FE ProtectedRoute (L1) luon khop voi action that su (L2).
   * Neu L1 revoke, user se bi 403 ngay o FE khi vao page.
   */
  saveMatrix = async (req, res, next) => {
    try {
      const roleId = Number(req.query.roleId || req.body.roleId);
      const { items } = req.body || {};
      if (!roleId) throw new ApiError(400, 'roleId la bat buoc');
      if (!Array.isArray(items)) throw new ApiError(400, 'items phai la mang');

      const role = await this.roleRepo.findById(roleId);
      if (!role) throw new ApiError(404, 'Role khong ton tai');

      // Guard: khong cho phep bo het quyen cua admin (last-admin lockout)
      if (PROTECTED_ROLES.has(role.roleName)) {
        const adminHasAny = items.some(
          (i) => i.canView || i.canCreate || i.canUpdate || i.canDelete || i.canExport
        );
        if (!adminHasAny) {
          throw new ApiError(409, 'Admin phai co it nhat 1 screen permission');
        }
      }

      // Normalize + View-first:
      //  - Có C/U/D/E → bắt buộc canView=true
      //  - canView=false → tắt hết C/U/D/E
      const normalized = items.map((i) => {
        let canCreate = Boolean(i.canCreate);
        let canUpdate = Boolean(i.canUpdate);
        let canDelete = Boolean(i.canDelete);
        let canExport = Boolean(i.canExport);
        let canView = Boolean(i.canView) || canCreate || canUpdate || canDelete || canExport;
        if (!canView) {
          canCreate = false;
          canUpdate = false;
          canDelete = false;
          canExport = false;
        }
        return {
          roleId,
          screenKey: String(i.screenKey),
          canView,
          canCreate,
          canUpdate,
          canDelete,
          canExport,
        };
      });

      const result = await this.repo.bulkUpsert(normalized);

      // === AUTO-SYNC L1 (screen:module:resource:access) theo L2 ===
      // Neu L1 grant/revoke thay doi -> user phai login lai de nhan quyen moi.
      let l1SyncResult = { changedKeys: [], grantedKeys: [], revokedKeys: [] };
      try {
        l1SyncResult = await this._autoSyncL1Access(roleId, normalized);
        if (l1SyncResult.changedKeys.length > 0) {
          console.log(
            `[RoleScreenMatrixController] auto-sync L1 cho role ${role.roleName} (id=${roleId}):`,
            `granted=${l1SyncResult.grantedKeys.length},`,
            `revoked=${l1SyncResult.revokedKeys.length}`
          );
        }
      } catch (syncErr) {
        console.warn('[RoleScreenMatrixController] auto-sync L1 failed (non-blocking):', syncErr.message);
      }

      // Invalidate cache + emit SSE
      this.permissionService.invalidateAllCache();
      let affectedUserCount = 0;
      let userIds = [];
      try {
        userIds = await this.repo.getUsersByRole(roleId);
        affectedUserCount = userIds.length;
        if (userIds.length > 0) {
          emitPermissionChanged({
            action: 'role_screen_matrix_updated',
            userIds,
            roleIds: [roleId],
            actorUserId: req.user?.userId || null,
            details: {
              count: normalized.length,
              l1Synced: l1SyncResult.changedKeys.length,
            },
          });

          // Bump token_version neu co L1 revoke (user that permission page access)
          if (l1SyncResult.revokedKeys.length > 0) {
            await this._bumpTokenVersions(userIds, req);
          }
        }
      } catch (eventErr) {
        console.warn('[RoleScreenMatrixController] SSE emit failed:', eventErr.message);
      }

      // Audit log + notification
      try {
        const actorName = req.user?.name || req.user?.email || 'Quản trị viên';
        await this.auditService.log({
          actorId: req.user?.userId,
          actorEmail: req.user?.email,
          action: 'SAVE_SCREEN_MATRIX',
          resource: 'role_screen_matrix',
          resourceId: String(roleId),
          details: {
            roleName: role.roleName,
            itemCount: normalized.length,
            activeItems: normalized.filter(
              (i) => i.canView || i.canCreate || i.canUpdate || i.canDelete || i.canExport
            ).length,
            l1Granted: l1SyncResult.grantedKeys.length,
            l1Revoked: l1SyncResult.revokedKeys.length,
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        const NotificationService = require('../../application/services/NotificationService');
        const ns = new NotificationService();
        await ns.notifyAdmins('PERMISSION_MATRIX_UPDATED', {
          actorName,
          roleScreen: true,
          targetName: role.roleLabel || role.roleName,
          count: normalized.length,
          permissionKey: role.roleName,
          actorId: req.user?.userId,
        }, { excludeUserId: req.user?.userId }).catch((err) =>
          console.warn('[RoleScreenMatrix] notifyAdmins failed:', err.message),
        );

        for (const userId of userIds) {
          await ns.notify('ROLE_CHANGED', {
            userId,
            roles: `Ma trận màn hình vai trò ${role.roleLabel || role.roleName}`,
            actorName,
            actorId: req.user?.userId,
          }, { skipSettings: true }).catch((err) =>
            console.warn('[RoleScreenMatrix] notify user failed:', err.message),
          );
        }
      } catch (auditErr) {
        console.warn('[RoleScreenMatrixController] audit log failed:', auditErr.message);
      }

      return res.json({
        success: true,
        data: {
          updated: result.updated,
          affectedUserCount,
          affectedRoleCount: 1,
          l1Synced: {
            granted: l1SyncResult.grantedKeys,
            revoked: l1SyncResult.revokedKeys,
          },
        },
        message: 'Da luu ma tran screen x action (L2 + auto-sync L1)',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * So sanh matrix giua nhieu role.
   */
  compareMatrix = async (req, res, next) => {
    try {
      const roleIdsParam = String(req.query.roleIds || '');
      const roleIds = roleIdsParam
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);

      if (roleIds.length === 0) throw new ApiError(400, 'roleIds la bat buoc (comma-separated)');
      if (roleIds.length > 7) throw new ApiError(400, 'Max 7 roles');

      const roles = await Promise.all(roleIds.map((id) => this.roleRepo.findById(id)));
      const { screens, grants } = await this.repo.getMatrixForRoles(roleIds);

      return res.json({
        success: true,
        data: {
          roles: roles.filter(Boolean).map((r) => ({
            id: r.id,
            roleName: r.roleName,
            roleLabel: r.roleLabel,
          })),
          screens,
          grants,
        },
        message: 'So sanh ma tran',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Auto-sync L1 (screen:module:resource:access) theo L2 (role_screen_permissions).
   *
   * Quy tac:
   *   - screen co IT NHAT 1 action (V/C/U/D/E) = true -> L1 = GRANTED.
   *   - TAT CA 5 actions = false -> L1 = REVOKED.
   *
   * Ly do: FE ProtectedRoute check L1 de render page, BE middleware check L2 cho
   * action. Neu chi sua L2 ma L1 van = true, user van vao duoc page nhung action
   * ben trong fail. Auto-sync dam bao 2 lop luon consistent.
   *
   * @returns {Promise<{changedKeys: string[], grantedKeys: string[], revokedKeys: string[]}>}
   */
  _autoSyncL1Access = async (roleId, items) => {
    if (!roleId || !Array.isArray(items) || items.length === 0) {
      return { changedKeys: [], grantedKeys: [], revokedKeys: [] };
    }

    const PermissionMatrixRepository = require('../../infrastructure/repositories/PermissionMatrixRepository');
    const permRepo = new PermissionMatrixRepository();

    // 1. Build desired L1 state tu L2 items
    //    L1 key format: 'screen:<module>:<resource>:access'
    const desiredL1 = new Map();
    for (const item of items) {
      if (!item.screenKey || typeof item.screenKey !== 'string') continue;
      const l1Key = `screen:${item.screenKey}:access`;
      const hasAnyAction =
        Boolean(item.canView) ||
        Boolean(item.canCreate) ||
        Boolean(item.canUpdate) ||
        Boolean(item.canDelete) ||
        Boolean(item.canExport);
      desiredL1.set(l1Key, hasAnyAction);
    }

    // 2. Load TAT CA L1 permission keys co trong permissions table (FK list).
    //    Day la danh sach cac L1 key hop le (admin co the grant/revoke).
    //    Neu l1Key khong co trong day -> khong the grant (FK violation).
    const allL1KeysInDb = await permRepo.getAllL1AccessKeys();

    // 3. Lay current L1 grants cho role.
    //    getGrants() chi tra ve grants dang active (co row trong role_permissions).
    //    Sau khi revoke, row bi DELETE -> key khong con xuat hien.
    //    Can biet ca 2 trang thai: granted (co row) vs revoked (FK exists, nhung row deleted).
    const allGrants = await permRepo.getGrants();
    const currentL1 = new Map();
    for (const g of allGrants) {
      if (Number(g.roleId) !== Number(roleId)) continue;
      if (Number(g.layer) !== 1) continue;
      if (!g.permissionKey || !g.permissionKey.startsWith('screen:') || !g.permissionKey.endsWith(':access')) continue;
      currentL1.set(g.permissionKey, true);
    }

    // 4. Compute diff
    //    - granted: FK exists in permissions table, L1 currently NOT granted (no row in role_permissions),
    //      nhung L2 desired = true -> can grant.
    //    - revoked: L1 currently granted (row exists), nhung L2 desired = false -> can revoke.
    //    - skip:   FK khong ton tai (khong the grant, FK violation).
    const grantedKeys = [];
    const revokedKeys = [];
    for (const [l1Key, desired] of desiredL1.entries()) {
      const isKnownKey = allL1KeysInDb.has(l1Key);
      if (!isKnownKey) continue; // L1 key chua co trong permissions table -> skip
      const current = currentL1.get(l1Key); // true = granted, undefined = revoked/not-granted
      if (desired && current !== true) grantedKeys.push(l1Key);
      if (!desired && current === true) revokedKeys.push(l1Key);
    }

    // 4. Apply grant/revoke
    for (const key of grantedKeys) {
      try {
        await permRepo.toggleGrantByKey(roleId, key, true);
      } catch (e) {
        console.warn(`[RoleScreenMatrixController] auto-sync L1 grant ${key} failed:`, e.message);
      }
    }
    for (const key of revokedKeys) {
      try {
        await permRepo.toggleGrantByKey(roleId, key, false);
      } catch (e) {
        console.warn(`[RoleScreenMatrixController] auto-sync L1 revoke ${key} failed:`, e.message);
      }
    }

    return {
      changedKeys: [...grantedKeys, ...revokedKeys],
      grantedKeys,
      revokedKeys,
    };
  };

  /**
   * Bump token_version cho users trong role (tru actor).
   * Dam bao user phai login lai de JWT cu (co permission cu) vo hieu luc.
   */
  _bumpTokenVersions = async (userIds, req) => {
    if (!Array.isArray(userIds) || userIds.length === 0) return;
    const actorId = req.user?.userId;
    for (const userId of userIds) {
      try {
        if (Number(userId) === Number(actorId)) continue;
        await this.authRepo.incrementTokenVersion(userId);
      } catch (err) {
        console.warn(`[RoleScreenMatrixController] bump token_version user ${userId} failed:`, err.message);
      }
    }
  };
}

module.exports = RoleScreenMatrixController;
