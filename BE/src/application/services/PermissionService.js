const ApiError = require('../../utils/ApiError');

/**
 * In-memory permission cache.
 * Key: userId → Set of permission_key strings
 * TTL: 60 seconds (auto-evict)
 */
const permissionCache = new Map();

const CACHE_TTL_MS = 60 * 1000;

/**
 * PermissionService — trung tâm kiểm tra quyền của toàn bộ hệ thống.
 * Thay thế hardcoded ROLE_PERMISSIONS map bằng đọc từ DB.
 */
class PermissionService {
  constructor({ roleRepository }) {
    this.roleRepository = roleRepository;
  }

  /**
   * Lấy toàn bộ permission keys của 1 user (từ cache hoặc DB).
   * Bao gom Layer 1 + Layer 2b (flatten) + User Override.
   * Day la set FULL - dung cho PermissionService.can() middleware.
   *
   * @param {number} userId
   * @param {object} [options]
   * @param {boolean} [options.skipCache=false] - Bypass cache (chi moi lan load)
   *   Dung khi admin vua thay doi permission cua user va can check ngay.
   * @returns {Promise<Set<string>>}
   */
  async getUserPermissions(userId, options = {}) {
    if (!options.skipCache) {
      const cached = permissionCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.permissions;
      }
    }

    const perms = await this.roleRepository.getUserPermissionKeys(userId);
    const permSet = new Set(perms);

    permissionCache.set(userId, {
      permissions: permSet,
      timestamp: Date.now(),
    });

    return permSet;
  }

  /**
   * Lay permission keys "compact" (Layer 1 + screen:*:access, KHONG flatten Layer 2b).
   * Dung cho JWT de tranh token qua lon (status 431).
   * Cache rieng voi key prefix 'compact:'.
   *
   * @param {number} userId
   * @param {object} [options]
   * @param {boolean} [options.skipCache=false] - Bypass cache
   * @returns {Promise<string[]>}
   */
  async getUserPermissionsCompact(userId, options = {}) {
    const cacheKey = `compact:${userId}`;
    if (!options.skipCache) {
      const cached = permissionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return Array.from(cached.permissions);
      }
    }

    const perms = await this.roleRepository.getUserPermissionKeysCompact(userId);
    const permSet = new Set(perms);

    permissionCache.set(cacheKey, {
      permissions: permSet,
      timestamp: Date.now(),
    });

    return Array.from(permSet);
  }

  /**
   * Kiểm tra user có một permission cụ thể không.
   * @param {number} userId
   * @param {string} permissionKey  vd: 'admin:users:create'
   * @param {object} [options]
   * @param {boolean} [options.skipCache=false] - Bypass cache khi check
   * @returns {Promise<boolean>}
   */
  async can(userId, permissionKey, options = {}) {
    if (!userId) return false;
    if (!permissionKey) return false;

    const perms = await this.getUserPermissions(userId, options);

    // Wildcard check: nếu user có '*' → full access
    if (perms.has('*')) return true;

    return perms.has(permissionKey);
  }

  /**
   * Kiểm tra user có TẤT CẢ các permissions được yêu cầu không.
   * @param {number} userId
   * @param {string[]} permissionKeys
   * @returns {Promise<boolean>}
   */
  async canAll(userId, permissionKeys, options = {}) {
    if (!Array.isArray(permissionKeys) || permissionKeys.length === 0) return true;
    for (const key of permissionKeys) {
      const ok = await this.can(userId, key, options);
      if (!ok) return false;
    }
    return true;
  }

  /**
   * Kiểm tra user có ÍT NHẤT 1 trong các permissions được yêu cầu không.
   * @param {number} userId
   * @param {string[]} permissionKeys
   * @returns {Promise<boolean>}
   */
  async canAny(userId, permissionKeys, options = {}) {
    if (!Array.isArray(permissionKeys) || permissionKeys.length === 0) return true;
    for (const key of permissionKeys) {
      const ok = await this.can(userId, key, options);
      if (ok) return true;
    }
    return false;
  }

  /**
   * Xoá cache của 1 user (gọi khi role/permission thay đổi).
   * @param {number} userId
   */
  invalidateCache(userId) {
    permissionCache.delete(userId);
  }

  /**
   * Xoá cache của TẤT CẢ users (dùng khi cần reset toàn bộ).
   */
  invalidateAllCache() {
    permissionCache.clear();
  }

  /**
   * Lấy cache statistics (debugging).
   */
  getCacheStats() {
    return {
      size: permissionCache.size,
      entries: Array.from(permissionCache.entries()).map(([uid, v]) => ({
        userId: uid,
        age: Date.now() - v.timestamp,
        permCount: v.permissions.size,
      })),
    };
  }
}

module.exports = PermissionService;
