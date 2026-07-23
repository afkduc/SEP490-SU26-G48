const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const PermissionMatrixRepository = require('../../infrastructure/repositories/PermissionMatrixRepository');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const AuditService = require('../../application/services/AuditService');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const PermissionService = require('../../application/services/PermissionService');

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
    this.auditService = new AuditService(AuditRepository);
    this.permissionService = new PermissionService({
      roleRepository: new RoleRepositoryImpl(),
    });
  }

  getMatrix = async (req, res, next) => {
    try {
      const [roles, screens, grants] = await Promise.all([
        this.repo.getRoles(),
        this.repo.getScreens(),
        this.repo.getGrants(),
      ]);
      return success(res, {
        roles,
        screens,
        grants,
        generatedAt: new Date().toISOString(),
      }, 'Ma tran quyen (role x screen)');
    } catch (err) {
      next(err);
    }
  };

  toggleCell = async (req, res, next) => {
    try {
      const { roleId, permissionId, granted } = req.body || {};
      if (!roleId || !permissionId || typeof granted !== 'boolean') {
        throw new ApiError(400, 'Thieu roleId/permissionId/granted');
      }

      // Khong cho phep revoke permission '*' cua admin (bao ve an toan).
      if (!granted) {
        const screens = await this.repo.getScreens();
        const screen = screens.find((s) => s.id === permissionId);
        if (screen && screen.permissionKey === '*') {
          const roles = await this.repo.getRoles();
          const role = roles.find((r) => r.id === roleId);
          if (role && role.roleName === 'admin') {
            throw new ApiError(409, 'Khong the thu hoi wildcard "*" cua admin role.');
          }
        }
      }

      const changed = await this.repo.toggleGrant(roleId, permissionId, granted);

      // Invalidate cache toan bo user de permission moi co hieu luc ngay.
      this.permissionService.invalidateAllCache();

      // Audit log
      await this.auditService.log({
        actorId: req.user?.userId,
        actorEmail: req.user?.email,
        action: granted ? 'GRANT_SCREEN_PERMISSION' : 'REVOKE_SCREEN_PERMISSION',
        resource: 'permission_matrix',
        resourceId: `${roleId}_${permissionId}`,
        details: { roleId, permissionId, granted, changed },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

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
      for (const c of cells) {
        if (!c || !c.roleId || !c.permissionId || typeof c.granted !== 'boolean') {
          results.push({ ...c, ok: false, reason: 'invalid' });
          continue;
        }
        const changed = await this.repo.toggleGrant(c.roleId, c.permissionId, c.granted);
        results.push({ ...c, ok: true, changed });
      }

      this.permissionService.invalidateAllCache();

      await this.auditService.log({
        actorId: req.user?.userId,
        actorEmail: req.user?.email,
        action: 'BULK_TOGGLE_SCREEN_PERMISSIONS',
        resource: 'permission_matrix',
        resourceId: 'bulk',
        details: { count: cells.length },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return success(res, { results }, 'Da cap nhat hang loat');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = PermissionMatrixController;