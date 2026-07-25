const ApiError = require('../../utils/ApiError');
const RoleScreenMatrixRepository = require('../../infrastructure/repositories/RoleScreenMatrixRepository');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const AuditService = require('../../application/services/AuditService');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const PermissionService = require('../../application/services/PermissionService');
const { emitPermissionChanged } = require('../../application/events/PermissionEvents');
const { generatePermissionKeys } = require('../../../scripts/auto-discover-permissions');

const PROTECTED_ROLES = new Set(['admin']);

/**
 * RoleScreenMatrixController - quan ly ma tran screen x action cho role.
 *
 * GET  /api/admin/role-screen-matrix?roleId=1
 *   -> { role, screenKeys, grants, generatedAt }
 *   Tra ve danh sach cac screen_key (auto-discovered tu routes) + cac quyen
 *   hien tai cua role.
 *
 * PUT  /api/admin/role-screen-matrix?roleId=1
 *   body: { items: [{ screenKey, canView, canCreate, canUpdate, canDelete, canExport }] }
 *   -> Bulk upsert trong 1 transaction, invalidate cache, emit SSE.
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
            resource: parts[1] || 'custom',
            availableView: false,
            availableCreate: false,
            availableUpdate: false,
            availableDelete: false,
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

      // Normalize items
      const normalized = items.map((i) => ({
        roleId,
        screenKey: String(i.screenKey),
        canView: Boolean(i.canView),
        canCreate: Boolean(i.canCreate),
        canUpdate: Boolean(i.canUpdate),
        canDelete: Boolean(i.canDelete),
        canExport: Boolean(i.canExport),
      }));

      const result = await this.repo.bulkUpsert(normalized);

      // Invalidate cache + emit SSE
      this.permissionService.invalidateAllCache();
      let affectedUserCount = 0;
      try {
        const userIds = await this.repo.getUsersByRole(roleId);
        affectedUserCount = userIds.length;
        if (userIds.length > 0) {
          emitPermissionChanged({
            action: 'role_screen_matrix_updated',
            userIds,
            roleIds: [roleId],
            actorUserId: req.user?.userId || null,
            details: { count: normalized.length },
          });
        }
      } catch (eventErr) {
        console.warn('[RoleScreenMatrixController] SSE emit failed:', eventErr.message);
      }

      // Audit log (best-effort)
      try {
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
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      } catch (auditErr) {
        console.warn('[RoleScreenMatrixController] audit log failed:', auditErr.message);
      }

      return res.json({
        success: true,
        data: { updated: result.updated, affectedUserCount, affectedRoleCount: 1 },
        message: 'Da luu ma tran screen x action',
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
}

module.exports = RoleScreenMatrixController;
