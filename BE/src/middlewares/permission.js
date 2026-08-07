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

    // PLAN A: Check DB mỗi request (skipCache=true) để đảm bảo permission mới nhất.
    // Lý do: JWT chỉ chứa compact permissions (Layer 1 + 2a). Nếu admin vừa
    // revoke qua Role Screen Matrix (Layer 2b), JWT vẫn còn permission cũ →
    // user pass giả. PermissionService có cache 60s sẵn; sau khi admin đổi →
    // controller gọi invalidateCache → request protected tiếp theo sẽ query lại.
    try {
      const ps = getPermissionService();
      const hasAll = await ps.canAll(userId, requiredPerms, { skipCache: true });

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

    // PLAN A: Check DB mỗi request (skipCache=true) - xem lý do ở requirePerm bên trên.
    try {
      const ps = getPermissionService();
      const hasAny = await ps.canAny(userId, permKeys, { skipCache: true });

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
 *   `screen:<module>:<resource>:access` (vd: `screen:dashboard:access`,
 *   `screen:admin:users:access`).
 *
 * Cach dung:
 *   - Truyen 1 arg:  requireScreen('dashboard')           -> 'screen:dashboard:access'
 *   - Truyen 2 args: requireScreen('admin', 'users')      -> 'screen:admin:users:access'
 *
 * Khi user khong co permission -> 403 voi message thong bao screen bi khoa.
 */
function requireScreen(module, resource) {
  let screenKey;
  if (resource === undefined || resource === null) {
    screenKey = `screen:${module}:access`;
  } else {
    screenKey = `screen:${module}:${resource}:access`;
  }

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Không xác định được user' });
    }

    // PLAN A: Luôn check DB (skipCache=true) để đảm bảo permission mới nhất.
    //
    // Lý do KHÔNG check JWT trước:
    //   - JWT có thể chứa permission cũ (admin vừa revoke qua Permission Matrix
    //     hoặc Role Screen Matrix).
    //   - Layer 1 (screen:<x>:access) và Layer 2b (screen:<x>:<action>) là 2 bảng
    //     RIÊNG BIỆT - JWT compact chỉ chứa Layer 1 + 2a.
    //   - Nếu dựa JWT → admin gỡ Layer 2b nhưng JWT cũ vẫn có Layer 1 → user
    //     vẫn pass vào trang.
    //   - Cache TTL 60s + JWT TTL 24h tạo "stale window" → user vào được trang
    //     đã bị revoke trong khoảng thời gian này.
    //
    // Trade-off: Mỗi request protected sẽ hit DB 1 lần. Tuy nhiên PermissionService
    // có cache 60s sẵn (vẫn dùng cache cho User X trong khoảng 60s để tránh
    // spam DB). Sau khi admin đổi permission → controller gọi invalidateCache
    // → request protected tiếp theo sẽ query lại.
    try {
      const ps = getPermissionService();
      const ok = await ps.can(userId, screenKey, { skipCache: true });

      if (!ok) {
        return res.status(403).json({
          success: false,
          message: `Không có quyền truy cập màn hình "${module}${resource ? '/' + resource : ''}". Liên hệ admin để được cấp quyền.`,
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
 * Middleware factory: kiem tra user co quyen THUC HIEN 1 action trong screen khong.
 *
 * Su dung cho role_screen_permissions (granular action-per-screen).
 *
 * Cach dung:
 *   - requireScreenAction('manager:services', 'view')     -> 'screen:manager:services:view'
 *   - requireScreenAction('manager:services', 'create')   -> 'screen:manager:services:create'
 *   - requireScreenAction('director:reports', 'export')   -> 'screen:director:reports:export'
 *
 * Action: view | create | update | delete | export
 *
 * Vi du:
 *   router.post('/services',
 *     requireScreenAction('manager:services', 'create'),
 *     controller.createService);
 *
 *   router.get('/reports/revenue',
 *     requireScreenAction('director:reports', 'view'),
 *     controller.getRevenueReports);
 *
 *   router.get('/reports/revenue/export',
 *     requireScreenAction('director:reports', 'export'),
 *     controller.exportRevenueReports);
 */
function requireScreenAction(screenKey, action) {
  // screenKey = "module:resource" (vd: "manager:services")
  // action = "view" | "create" | "update" | "delete" | "export"
  const validActions = ['view', 'create', 'update', 'delete', 'export'];
  if (!validActions.includes(action)) {
    throw new Error(`requireScreenAction: invalid action "${action}". Must be one of ${validActions.join(', ')}`);
  }
  const permKey = `screen:${screenKey}:${action}`;

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }

    const userId = req.user.userId || req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Không xác định được user' });
    }

    // PLAN A: Check DB mỗi request (skipCache=true) - xem lý do ở requirePerm.
    try {
      const ps = getPermissionService();
      const ok = await ps.can(userId, permKey, { skipCache: true });

      if (!ok) {
        return res.status(403).json({
          success: false,
          message: `Không có quyền "${action}" trên màn "${screenKey}". Liên hệ admin để được cấp quyền.`,
          required: [permKey],
        });
      }

      next();
    } catch (err) {
      console.error('[requireScreenAction] Error checking permission:', err);
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

module.exports = { requirePerm, requireAnyPerm, requireScreen, requireScreenAction, invalidateUserCache };
