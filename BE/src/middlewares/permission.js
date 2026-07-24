/**
 * Permission Middleware — trung tâm kiểm tra quyền cho toàn bộ hệ thống.
 *
 * Thay thế hardcoded ROLE_PERMISSIONS map bằng đọc từ DB.
 * Dùng shared PermissionService singleton để tận dụng cache.
 *
 * Cách dùng:
 *   router.post('/users', requirePerm('admin:users:create'), handler)
 *   router.get('/reports', requirePerm('reports:read', 'reports:export'), handler)
 */

const PermissionService = require('../application/services/PermissionService');
const RoleRepositoryImpl = require('../infrastructure/repositories/RoleRepositoryImpl');

// Singleton — cùng cache cho tất cả requests
let _permissionService = null;

function getPermissionService() {
  if (!_permissionService) {
    _permissionService = new PermissionService({
      roleRepository: new RoleRepositoryImpl(),
    });
  }
  return _permissionService;
}

/**
 * Middleware factory: kiểm tra user có permission cần thiết không.
 *
 * @param {...string} requiredPerms - Các permission keys cần có.
 *   - Nếu truyền nhiều param → user phải có TẤT CẢ (AND)
 *   - Nếu muốn OR → dùng requireAnyPerm
 *
 * Ví dụ:
 *   requirePerm('users:read')                    // phải có users:read
 *   requirePerm('users:read', 'users:write')    // phải có cả 2
 */
function requirePerm(...requiredPerms) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Không xác định được user' });
    }

    try {
      const ps = getPermissionService();
      const hasAll = await ps.canAll(userId, requiredPerms);

      if (!hasAll) {
        return res.status(403).json({
          success: false,
          message: `Không có quyền: ${requiredPerms.join(', ')}`,
          required: requiredPerms,
        });
      }

      next();
    } catch (err) {
      console.error('[requirePerm] Error checking permission:', err);
      return res.status(500).json({ success: false, message: 'Lỗi kiểm tra quyền' });
    }
  };
}

/**
 * Middleware factory: kiểm tra user có ÍT NHẤT 1 trong các permissions.
 *
 * @param {...string} permKeys - Các permission keys.
 *
 * Ví dụ:
 *   requireAnyPerm('users:create', 'users:manage')  // có 1 trong 2 là đủ
 */
function requireAnyPerm(...permKeys) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Không xác định được user' });
    }

    try {
      const ps = getPermissionService();
      const hasAny = await ps.canAny(userId, permKeys);

      if (!hasAny) {
        return res.status(403).json({
          success: false,
          message: `Không có quyền: ${permKeys.join(' hoặc ')}`,
          required: permKeys,
        });
      }

      next();
    } catch (err) {
      console.error('[requireAnyPerm] Error checking permission:', err);
      return res.status(500).json({ success: false, message: 'Lỗi kiểm tra quyền' });
    }
  };
}

/**
 * Middleware factory: kiem tra user co quyen vao 1 SCREEN (UI page) hay khong.
 *
 * Su dung cho permission matrix: moi UI page tuong ung voi 1 permission_key
 *   `screen:<module>:<resource>:access`
 *
 * Cach dung:
 *   router.get('/admin/users', authenticate, requireScreen('admin', 'users'), handler)
 *
 * Khi user khong co permission -> 403 voi message thong bao screen bi khoa.
 */
function requireScreen(module, resource) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Không xác định được user' });
    }

    const screenKey = `screen:${module}:${resource}:access`;

    try {
      const ps = getPermissionService();
      const ok = await ps.can(userId, screenKey);

      if (!ok) {
        return res.status(403).json({
          success: false,
          message: `Không có quyền truy cập màn hình "${module}/${resource}". Liên hệ admin để được cấp quyền.`,
          required: [screenKey],
        });
      }

      next();
    } catch (err) {
      console.error('[requireScreen] Error checking permission:', err);
      return res.status(500).json({ success: false, message: 'Lỗi kiểm tra quyền' });
    }
  };
}

/**
 * Invalidate cache của 1 user (export để controller gọi khi cần).
 */
function invalidateUserCache(userId) {
  const ps = getPermissionService();
  ps.invalidateCache(userId);
}

module.exports = { requirePerm, requireAnyPerm, requireScreen, invalidateUserCache };
