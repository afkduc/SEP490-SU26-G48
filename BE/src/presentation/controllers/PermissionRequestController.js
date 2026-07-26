/**
 * PermissionRequestController - Workflow admin duyet/tu choi yeu cau cap quyen.
 *
 * Khong them bang permission_request moi - tap dung bang [notifications] co san
 * (khi user goi POST /api/profile/me/request-permission BE da insert row
 * type=PERMISSION_REQUEST). Mot row nhu vay se duoc hieu la "request pending"
 * khi:
 *   - metadata.requesterId <> null
 *   - metadata.permissionKey <> null
 *   - is_read = 0
 *
 * Approve flow:
 *   - Lookup notification (id param) -> lay permissionKey, requesterId, reason
 *   - Validate user + permission key
 *   - UPSERT user_screen_permissions (override_type='grant', view/create/update/delete/export = 1)
 *   - Bump token_version(userId) -> user se bi 401 o request tiep theo
 *   - Mark notification is_read=1
 *   - Insert notification moi cho user (type='PERMISSION_GRANTED')
 *   - Emit permission-changed SSE de user dang online refresh
 *
 * Reject flow:
 *   - Lookup notification -> lay requesterId, reason
 *   - Mark notification is_read=1
 *   - Insert notification moi cho user (type='PERMISSION_REJECTED')
 *   - (Khong bump token_version - gi? nguyen quyen hien tai)
 */
const { query } = require('../../infrastructure/database/sqlServer');
const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const UserScreenPermissionsRepository = require('../../infrastructure/repositories/UserScreenPermissionsRepository');
const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
const UserRepositoryImpl = require('../../infrastructure/repositories/UserRepositoryImpl');
const PermissionService = require('../../application/services/PermissionService');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const NotificationService = require('../../application/services/NotificationService');
const AuditService = require('../../application/services/AuditService');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const { emitPermissionChanged } = require('../../application/events/PermissionEvents');

class PermissionRequestController {
  constructor() {
    this.userScreenPermRepo = new UserScreenPermissionsRepository();
    this.authRepo = new AuthRepositoryImpl();
    this.userRepo = new UserRepositoryImpl();
    this.roleRepo = new RoleRepositoryImpl();
    this.notificationService = new NotificationService();
    this.auditService = new AuditService(AuditRepository);
    this.permissionService = new PermissionService({
      roleRepository: this.roleRepo,
    });
  }

  /**
   * Lay danh sach request pending (type=PERMISSION_REQUEST, is_read=0) cua tat ca admin.
   *
   * Tra ve: [{ requestId, userId, userEmail, userName, permissionKey, reason, page, createdAt }]
   * - requestId = notifications.id (admin se approve/reject theo id nay)
   */
  listPending = async (req, res, next) => {
    try {
      const result = await query(
        `SELECT n.id AS requestId, n.user_id, n.metadata, n.created_at
         FROM notifications n
         WHERE n.type = 'PERMISSION_REQUEST'
           AND n.is_read = 0
         ORDER BY n.created_at DESC`,
      );

      const rows = [];
      const seen = new Set();
      for (const row of result.recordset) {
        let meta = {};
        try {
          meta = row.metadata
            ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata)
            : {};
        } catch (e) {
          meta = {};
        }
        const permissionKey = meta.permissionKey || meta.quickAssignPermission || null;
        const requesterId = Number(meta.requesterId) || null;
        if (!permissionKey || !requesterId) continue;

        const dedupeKey = `${requesterId}:${permissionKey}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const userResult = await query(
          `SELECT id, email, user_name, first_name, last_name, status
           FROM users WHERE id = @p1`,
          { p1: requesterId }
        );
        const u = userResult.recordset[0];
        if (!u) continue;

        rows.push({
          requestId: row.requestId,
          userId: requesterId,
          userEmail: u.email,
          userName:
            [u.first_name, u.last_name].filter(Boolean).join(' ')
            || u.user_name
            || u.email,
          userStatus: u.status,
          permissionKey,
          reason: meta.reason || null,
          page: meta.page || null,
          requesterId,
          createdAt: row.created_at,
        });
      }

      return success(res, { items: rows, total: rows.length }, 'Pending permission requests');
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/admin/permission-requests/:id/approve
   *
   * Parse permission key tu notification metadata -> grant all 5 actions
   * (view/create/update/delete/export) cho requesterId qua user_screen_permissions
   * voi override_type='grant'. Sau do bump token_version de user bi 401 o
   * request tiep theo (SessionExpiredModal se hien ngay).
   */
  approve = async (req, res, next) => {
    try {
      const requestId = Number(req.params.id);
      if (!requestId) throw new ApiError(400, 'requestId khong hop le');

      const notif = await this._loadRequestNotification(requestId);
      const meta = notif.metadata || {};
      const userId = Number(meta.requesterId || notif.userId);
      const permissionKey = meta.permissionKey || meta.quickAssignPermission;
      if (!userId || !permissionKey) {
        throw new ApiError(400, 'Notification khong chua permissionKey/requesterId hop le');
      }

      const screenKey = this._extractScreenKey(permissionKey);
      if (!screenKey) {
        throw new ApiError(400, `permissionKey "${permissionKey}" khong phai screen-level (chi ho tro screen:*)`);
      }

      // Grant 1 screen (không wipe override khác)
      await this.userScreenPermRepo.upsertGrant(userId, {
        screenKey,
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canExport: true,
        overrideType: 'grant',
        note: `Approved by admin ${req.user?.email || req.user?.userId} (request #${requestId})`,
      }, req.user?.userId);

      // Invalidate cache + emit SSE permission-changed
      this.permissionService.invalidateAllCache();
      try {
        emitPermissionChanged({
          action: 'permission_request_approved',
          userIds: [userId],
          roleIds: [],
          actorUserId: req.user?.userId || null,
          details: { permissionKey, screenKey, requestId },
        });
      } catch (e) {
        console.warn('[PermissionRequestController] SSE emit failed:', e.message);
      }

      // Bump token_version -> user bi 401 o request tiep theo
      let newTokenVersion = null;
      try {
        newTokenVersion = await this.authRepo.incrementTokenVersion(userId);
      } catch (e) {
        console.warn('[PermissionRequestController] bump token_version failed:', e.message);
      }

      // Đánh dấu đã xử lý TẤT CẢ bản sao thông báo cùng requester + permissionKey
      // (notifyAdmins có thể tạo nhiều row cho nhiều admin)
      await this._markRelatedRequestsRead(requestId, permissionKey, userId);

      // Notify user
      try {
        await this.notificationService.notify('PERMISSION_GRANTED', {
          userId,
          permissionKey,
          screenKey,
          note: meta.reason || null,
          actorName: req.user?.name || req.user?.email || 'Quản trị viên',
          actorId: req.user?.userId,
        }, { skipSettings: true });

        await this.notificationService.notifyAdmins('PERMISSION_MATRIX_UPDATED', {
          actorName: req.user?.name || req.user?.email || 'Quản trị viên',
          permissionKey: `Duyệt yêu cầu: ${permissionKey}`,
          targetName: String(userId),
          actorId: req.user?.userId,
        }, { excludeUserId: req.user?.userId });
      } catch (e) {
        console.warn('[PermissionRequestController] notify user failed:', e.message);
      }

      // Audit log
      try {
        await this.auditService.log({
          actorId: req.user?.userId,
          actorEmail: req.user?.email,
          action: 'APPROVE_PERMISSION_REQUEST',
          resource: 'permission_request',
          resourceId: String(requestId),
          details: { targetUserId: userId, permissionKey, screenKey, newTokenVersion },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      } catch (e) {
        console.warn('[PermissionRequestController] audit log failed:', e.message);
      }

      return success(res, {
        requestId,
        userId,
        permissionKey,
        screenKey,
        newTokenVersion,
      }, 'Da duyet yeu cau va cap quyen cho user');
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/admin/permission-requests/:id/reject
   * body: { reason } (optional)
   */
  reject = async (req, res, next) => {
    try {
      const requestId = Number(req.params.id);
      if (!requestId) throw new ApiError(400, 'requestId khong hop le');

      const rejectReason = (req.body && req.body.reason) || null;
      const notif = await this._loadRequestNotification(requestId);
      const meta = notif.metadata || {};
      const userId = Number(meta.requesterId || notif.userId);
      const permissionKey = meta.permissionKey || meta.quickAssignPermission;

      // Đánh dấu đã xử lý mọi bản sao thông báo liên quan
      await this._markRelatedRequestsRead(requestId, permissionKey, userId);

      // Notify user
      if (userId) {
        try {
          await this.notificationService.notify('PERMISSION_REJECTED', {
            userId,
            permissionKey,
            reason: rejectReason || meta.reason || null,
            actorName: req.user?.name || req.user?.email || 'Quản trị viên',
            actorId: req.user?.userId,
          }, { skipSettings: true });
        } catch (e) {
          console.warn('[PermissionRequestController] notify rejected failed:', e.message);
        }
      }

      // Audit log
      try {
        await this.auditService.log({
          actorId: req.user?.userId,
          actorEmail: req.user?.email,
          action: 'REJECT_PERMISSION_REQUEST',
          resource: 'permission_request',
          resourceId: String(requestId),
          details: { targetUserId: userId, permissionKey, rejectReason },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      } catch (e) {
        console.warn('[PermissionRequestController] audit log failed:', e.message);
      }

      return success(res, { requestId, userId, permissionKey }, 'Da tu choi yeu cau');
    } catch (err) {
      next(err);
    }
  };

  // ===== Helpers =====

  async _loadRequestNotification(id) {
    const result = await query(
      `SELECT id, user_id, type, metadata, is_read
       FROM notifications WHERE id = @p1 AND type = 'PERMISSION_REQUEST'`,
      { p1: id },
    );
    const row = result.recordset[0];
    if (!row) throw new ApiError(404, 'Khong tim thay yeu cau quyen');
    if (row.is_read) throw new ApiError(409, 'Yeu cau nay da duoc xu ly truoc do');
    let meta = {};
    try {
      meta = row.metadata ? JSON.parse(row.metadata) : {};
    } catch (e) {
      meta = {};
    }
    return { ...row, metadata: meta };
  }

  /**
   * Mark all PERMISSION_REQUEST notifications for the same requester+permissionKey as read.
   * Falls back to at least marking the clicked requestId.
   */
  async _markRelatedRequestsRead(requestId, permissionKey, requesterId) {
    const id = Number(requestId) || 0;
    const key = permissionKey ? String(permissionKey) : '';
    const rid = Number(requesterId) || 0;

    try {
      if (key && rid) {
        // SQL Server: metadata is NVARCHAR JSON from notifyAdmins
        await query(
          `UPDATE notifications
           SET is_read = 1
           WHERE type = 'PERMISSION_REQUEST'
             AND is_read = 0
             AND (
               id = @p1
               OR (
                 (
                   JSON_VALUE(CAST(metadata AS NVARCHAR(MAX)), '$.permissionKey') = @p2
                   OR JSON_VALUE(CAST(metadata AS NVARCHAR(MAX)), '$.quickAssignPermission') = @p2
                 )
                 AND TRY_CAST(JSON_VALUE(CAST(metadata AS NVARCHAR(MAX)), '$.requesterId') AS INT) = @p3
               )
             )`,
          { p1: id, p2: key, p3: rid },
        );
        return;
      }
    } catch (e) {
      console.warn('[PermissionRequestController] bulk mark related failed, fallback single:', e.message);
    }

    await query(
      `UPDATE notifications SET is_read = 1 WHERE id = @p1`,
      { p1: id },
    );
  }

  /**
   * Extract screen_key tu permissionKey.
   * VD: "screen:profile:access" -> "profile:profile" (hoac "profile" neu service key)
   * Bo qua "permission_request:approve" vi day khong phai screen-level.
   */
  _extractScreenKey(permissionKey) {
    if (!permissionKey || typeof permissionKey !== 'string') return null;
    if (!permissionKey.startsWith('screen:')) return null;
    const parts = permissionKey.split(':').filter(Boolean);
    if (parts.length < 2) return null;
    // screen:<module>[:<resource>...]:access|view|...
    const ACTIONS = new Set(['access', 'view', 'create', 'update', 'delete', 'export']);
    let end = parts.length;
    if (ACTIONS.has(parts[parts.length - 1])) end -= 1;
    const keyParts = parts.slice(1, end);
    if (keyParts.length === 0) return null;
    return keyParts.join(':');
  }
}

module.exports = PermissionRequestController;
