const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ApiError = require('../../utils/ApiError');
const { toUserDto } = require('../dto/AuthDto');
const config = require('../../config');
const PermissionService = require('./PermissionService');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const PendingLoginStore = require('./PendingLoginStore');

const STALE_MINUTES = parseInt(process.env.LOGIN_SESSION_STALE_MINUTES || '5', 10);
/** Giữ flag cũ: chỉ bật Approve/Reject nếu LOGIN_CHALLENGE_ENABLED=true (mặc định tắt). */
const LOGIN_CHALLENGE_ENABLED = process.env.LOGIN_CHALLENGE_ENABLED === 'true';
class AuthService {
  constructor(authRepository) {
    this.authRepository = authRepository;
  }

  /** Lazy-init PermissionService (avoid circular dependency at module load) */
  _getPermissionService() {
    if (!this._permissionService) {
      this._permissionService = new PermissionService({
        roleRepository: new RoleRepositoryImpl(),
      });
    }
    return this._permissionService;
  }

  /**
   * Đóng session "ma" (không heartbeat trong STALE_MINUTES) trước khi check conflict.
   */
  async _closeStaleSessionsForUser(userId) {
    const { query } = require('../../infrastructure/database/sqlServer');
    await query(
      `UPDATE login_sessions
       SET    logout_time              = SYSUTCDATETIME(),
              logout_reason            = 'TIMEOUT',
              session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
              status                   = 'ended'
       WHERE  user_id     = @p1
         AND  status      = 'active'
         AND  action_type = 'LOGIN'
         AND  COALESCE(last_activity_at, login_time) < DATEADD(MINUTE, -@p2, SYSUTCDATETIME())`,
      { p1: userId, p2: STALE_MINUTES }
    );
  }

  async _findLiveSession(userId) {
    const { query } = require('../../infrastructure/database/sqlServer');
    const active = await query(
      `SELECT TOP 1 id, browser, os, ip_address, login_time, last_activity_at
       FROM login_sessions
       WHERE user_id = @p1
         AND status = 'active'
         AND action_type = 'LOGIN'
         AND COALESCE(last_activity_at, login_time) >= DATEADD(MINUTE, -@p2, SYSUTCDATETIME())
       ORDER BY COALESCE(last_activity_at, login_time) DESC`,
      { p1: userId, p2: STALE_MINUTES }
    );
    return active.recordset[0] || null;
  }

  /** Đóng mọi phiên LOGIN đang active của user (login mới thay phiên cũ). */
  async _closeActiveSessionsForUser(userId, reason = 'FORCE_NEW_LOGIN') {
    const { query } = require('../../infrastructure/database/sqlServer');
    await query(
      `UPDATE login_sessions
       SET    logout_time              = SYSUTCDATETIME(),
              logout_reason            = @p2,
              session_duration_seconds = DATEDIFF_BIG(SECOND, login_time, SYSUTCDATETIME()),
              status                   = 'ended'
       WHERE  user_id     = @p1
         AND  status      = 'active'
         AND  action_type = 'LOGIN'`,
      { p1: userId, p2: String(reason).slice(0, 64) }
    );
  }

  /**
   * @param {object} opts
   * @param {boolean} [opts.force] - true = đóng phiên cũ và đăng nhập ngay (sau countdown FE)
   * @param {string} [opts.pendingId] - hoàn tất sau khi phiên cũ approve (legacy)
   * @param {object} [opts.clientMeta] - { ip, userAgent, browser, os }
   */
  async login(identifier, password, branchId, { force = false, pendingId = null, clientMeta = {} } = {}) {
    if (!identifier || !password) {
      const e = new ApiError(400, 'Email/số điện thoại và mật khẩu không được để trống');
      e.audit = { skip: true };
      throw e;
    }

    // Hoàn tất sau khi phiên cũ đã approve (legacy, chỉ khi LOGIN_CHALLENGE_ENABLED)
    if (pendingId) {
      return this._completePendingLogin(pendingId, identifier, password);
    }

    const user = await this.authRepository.findUserByEmailOrPhone(identifier);
    if (!user) {
      const e = new ApiError(401, 'Email/số điện thoại hoặc mật khẩu không đúng');
      e.audit = { userExists: false };
      throw e;
    }

    const isMatch = await this._verifyPassword(password, user.user_password);
    if (!isMatch) {
      const e = new ApiError(401, 'Email/số điện thoại hoặc mật khẩu không đúng');
      e.audit = { userExists: true, user, reason: 'WRONG_PASSWORD' };
      throw e;
    }

    if (user.status && user.status !== 'active') {
      const e = new ApiError(403, 'Tài khoản đã ngừng hoạt động');
      e.audit = { userExists: true, user, reason: 'ACCOUNT_DISABLED' };
      throw e;
    }

    if (user.branch_id && user.branch_is_active !== undefined && !Boolean(user.branch_is_active)) {
      const e = new ApiError(403, 'Chi nhánh của tài khoản này đang bị ngưng hoạt động');
      e.audit = { userExists: true, user, reason: 'BRANCH_DISABLED' };
      throw e;
    }

    const roles = await this.authRepository.findUserRoles(user.id);
    const isBranchExempt = roles.some(
      (r) => r.role_name === 'admin' || r.role_name === 'general_director'
    );

    if (user.branch_id && !isBranchExempt && String(user.branch_id) !== String(branchId)) {
      const e = new ApiError(403, 'Tài khoản của bạn không có quyền đăng nhập vào chi nhánh này');
      e.audit = { userExists: true, user, reason: 'WRONG_BRANCH' };
      throw e;
    }

    // Dọn session stale rồi mới xét conflict thật (heartbeat còn sống)
    await this._closeStaleSessionsForUser(user.id);
    const live = await this._findLiveSession(user.id);

    // Chính sách mới: có phiên sống thì thay thế ngay, không chờ countdown.
    // Giữ biến `force` chỉ để backward-compat với FE cũ.
    const replacedLive = Boolean(live);
    if (live) {
      await this._closeActiveSessionsForUser(user.id, 'FORCE_NEW_LOGIN');
    }

    const newTokenVersion = await this.authRepository.incrementTokenVersion(user.id);
    user.token_version = newTokenVersion;

    if (replacedLive) {
      this._notifySessionTakenOver(user.id, clientMeta).catch(() => {});
    }

    return { user, pendingComplete: false };
  }

  async _completePendingLogin(pendingId, identifier, password) {
    const pending = PendingLoginStore.getPending(pendingId);
    if (!pending) {
      throw new ApiError(404, 'Yêu cầu đăng nhập không tồn tại hoặc đã hết hạn');
    }
    if (pending.status === 'rejected') {
      const e = new ApiError(403, 'Yêu cầu đăng nhập đã bị từ chối bởi phiên đang đăng nhập.');
      e.code = 'LOGIN_REJECTED';
      throw e;
    }
    if (pending.status === 'expired' || pending.expiresAt <= Date.now()) {
      PendingLoginStore.updatePending(pendingId, { status: 'expired' });
      throw new ApiError(410, 'Yêu cầu đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    if (pending.status !== 'approved') {
      const e = new ApiError(409, 'Đang chờ phiên hiện tại xác nhận đăng nhập...');
      e.code = 'LOGIN_PENDING';
      e.details = { code: 'LOGIN_PENDING', pendingId, status: pending.status };
      throw e;
    }

    if (String(identifier).trim().toLowerCase() !== String(pending.identifier).trim().toLowerCase()) {
      throw new ApiError(400, 'Thông tin đăng nhập không khớp yêu cầu đang chờ');
    }

    const ok = await bcrypt.compare(password, pending.passwordFingerprint);
    if (!ok) {
      throw new ApiError(401, 'Email/số điện thoại hoặc mật khẩu không đúng');
    }

    const user = await this.authRepository.findUserByEmailOrPhone(identifier);
    if (!user || String(user.id) !== String(pending.userId)) {
      throw new ApiError(401, 'Không thể hoàn tất đăng nhập');
    }

    const newTokenVersion = await this.authRepository.incrementTokenVersion(user.id);
    user.token_version = newTokenVersion;

    PendingLoginStore.updatePending(pendingId, { status: 'completed' });
    return { user, pendingComplete: true, pending };
  }

  async approvePendingLogin(userId, pendingId) {
    const pending = PendingLoginStore.getPending(pendingId);
    if (!pending || String(pending.userId) !== String(userId)) {
      throw new ApiError(404, 'Không tìm thấy yêu cầu đăng nhập');
    }
    if (pending.status !== 'pending') {
      throw new ApiError(409, `Yêu cầu đã ở trạng thái: ${pending.status}`);
    }
    if (pending.expiresAt <= Date.now()) {
      PendingLoginStore.updatePending(pendingId, { status: 'expired' });
      throw new ApiError(410, 'Yêu cầu đã hết hạn');
    }
    return PendingLoginStore.updatePending(pendingId, { status: 'approved', decidedAt: Date.now() });
  }

  async rejectPendingLogin(userId, pendingId) {
    const pending = PendingLoginStore.getPending(pendingId);
    if (!pending || String(pending.userId) !== String(userId)) {
      throw new ApiError(404, 'Không tìm thấy yêu cầu đăng nhập');
    }
    if (pending.status !== 'pending') {
      throw new ApiError(409, `Yêu cầu đã ở trạng thái: ${pending.status}`);
    }
    return PendingLoginStore.updatePending(pendingId, { status: 'rejected', decidedAt: Date.now() });
  }

  getPendingStatus(pendingId) {
    const pending = PendingLoginStore.getPending(pendingId);
    if (!pending) {
      return { status: 'expired', pendingId };
    }
    if (pending.status === 'pending' && pending.expiresAt <= Date.now()) {
      PendingLoginStore.updatePending(pendingId, { status: 'expired' });
      return { status: 'expired', pendingId };
    }
    return {
      status: pending.status,
      pendingId,
      expiresAt: new Date(pending.expiresAt).toISOString(),
      session: pending.activeSession || null,
    };
  }

  /** Phiên đang online poll để hiện alert lớn khi có thiết bị khác xin vào. */
  listPendingChallengesForUser(userId) {
    return PendingLoginStore.listPendingForUser(userId).map((p) => ({
      pendingId: p.id,
      status: p.status,
      expiresAt: new Date(p.expiresAt).toISOString(),
      clientMeta: p.clientMeta || null,
      activeSession: p.activeSession || null,
    }));
  }

  async _notifyLoginChallenge(userId, pending) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      const deviceLabel = [pending.clientMeta?.browser, pending.clientMeta?.os]
        .filter(Boolean)
        .join(' · ') || 'Thiết bị khác';
      await ns.notify(
        'LOGIN_CHALLENGE',
        {
          userId,
          device: deviceLabel,
          ip: pending.clientMeta?.ip,
          browser: pending.clientMeta?.browser,
          os: pending.clientMeta?.os,
          pendingId: pending.id,
        },
        { skipSettings: true }
      );
    } catch (err) {
      console.warn('[AuthService] LOGIN_CHALLENGE notify failed:', err.message);
    }
  }

  /** Báo phiên cũ: đã có thiết bị khác đăng nhập (sau force takeover). */
  async _notifySessionTakenOver(userId, clientMeta = {}) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      await ns.notify(
        'SESSION_TAKEN_OVER',
        {
          userId,
        },
        { skipSettings: true }
      );
    } catch (err) {
      console.warn('[AuthService] SESSION_TAKEN_OVER notify failed:', err.message);
    }
  }

  async _verifyPassword(input, stored) {
    if (stored && stored.startsWith('$2b$')) {
      return bcrypt.compare(input, stored);
    }
    // Fallback: plain text (chỉ dùng khi dev, chưa hash password trong DB)
    return input === stored;
  }

  /**
   * Tao JWT moi co deviceId (dung khi login thanh cong)
   */
  async issueTokenWithDevice(user, deviceId, options = {}) {
    return this._signToken(user, deviceId, options);
  }

  /**
   * Tao token nhung chua co deviceId - du lieu user phai co token_version
   */
  async issueTokenWithoutDevice(user, options = {}) {
    return this._signToken(user, null, options);
  }

  async _signToken(user, deviceId, options = {}) {
    const roles = await this.authRepository.findUserRoles(user.id);
    const permissionService = this._getPermissionService();
    // JWT: compact (L1 + screen:*:access + feature keys) — tránh 431.
    // FE UI: effectivePermissions (full flatten L2 view/create/...) lưu localStorage.
    // options.skipCache = true: dung khi refresh permissions (admin vua thay doi).
    const compactKeys = await permissionService.getUserPermissionsCompact(user.id, options);
    const fullPermSet = await permissionService.getUserPermissions(user.id, options);
    const effectivePermissions = Array.from(fullPermSet);

    const userDto = toUserDto({ ...user, token_version: user.token_version }, roles, compactKeys);

    const tokenPayload = {
      userId: userDto.id,
      email: userDto.email,
      name: userDto.name,
      roles: userDto.roles,
      permissions: compactKeys,
      branchId: userDto.branchId,
      tokenVersion: userDto.tokenVersion,
    };

    if (deviceId) {
      tokenPayload.deviceId = deviceId;
    }
    if (user.sessionId) {
      tokenPayload.sessionId = user.sessionId;
    }

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    return { token, user: userDto, effectivePermissions };
  }
}

module.exports = AuthService;
