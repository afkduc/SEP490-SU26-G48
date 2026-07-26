const { success } = require('../../utils/response');
const { trackLogin, trackLoginFailed, parseUserAgent, getRequestMeta } = require('../../middlewares/loginSessionMiddleware');
const PermissionService = require('../../application/services/PermissionService');
const RoleRepositoryImpl = require('../../infrastructure/repositories/RoleRepositoryImpl');
const PasswordResetService = require('../../application/services/PasswordResetService');
const AuthRepositoryImpl = require('../../infrastructure/repositories/AuthRepositoryImpl');
const NotificationService = require('../../application/services/NotificationService');
const LoginAttemptGuard = require('../../application/services/LoginAttemptGuard');
const { auditCrud } = require('../../utils/auditHelper');
const ApiError = require('../../utils/ApiError');

class AuthController {
  constructor(authService) {
    this.authService = authService;
    this.passwordResetService = new PasswordResetService(new AuthRepositoryImpl());
    this.notificationService = new NotificationService();
    this.login = this.login.bind(this);
    this.getMe = this.getMe.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.getPendingLogin = this.getPendingLogin.bind(this);
    this.listMyLoginChallenges = this.listMyLoginChallenges.bind(this);
    this.approvePendingLogin = this.approvePendingLogin.bind(this);
    this.rejectPendingLogin = this.rejectPendingLogin.bind(this);
    this._permissionService = null;
  }

  _getPermissionService() {
    if (!this._permissionService) {
      this._permissionService = new PermissionService({
        roleRepository: new RoleRepositoryImpl(),
      });
    }
    return this._permissionService;
  }

  _clientIp(req) {
    try {
      const meta = getRequestMeta(req);
      return meta?.ipAddress || req.ip || '';
    } catch {
      return req.ip || '';
    }
  }

  async login(req, res, next) {
    try {
      const identifier = req.body.identifier || req.body.email || req.body.phone;
      const { password, branchId, force, pendingId } = req.body;
      const ip = this._clientIp(req);

      try {
        LoginAttemptGuard.assertNotLocked(identifier, ip);
      } catch (lockErr) {
        const e = new ApiError(lockErr.statusCode || 429, lockErr.message);
        e.code = lockErr.code;
        e.details = lockErr.details;
        e.audit = { skip: true };
        throw e;
      }

      const ua = req.headers['user-agent'] || '';
      const { browser, os } = parseUserAgent(ua);

      const { user } = await this.authService.login(identifier, password, branchId, {
        force: Boolean(force),
        pendingId: pendingId || null,
        clientMeta: { ip, userAgent: ua, browser, os },
      });

      LoginAttemptGuard.clearFailures(identifier, ip);

      const trackResult = await trackLogin(req, user);
      const deviceId = trackResult?.deviceId || null;
      const sessionId = trackResult?.sessionId || null;
      user.sessionId = sessionId;

      const result = await this.authService.issueTokenWithDevice(user, deviceId);
      return success(
        res,
        {
          token: result.token,
          user: {
            ...result.user,
            permissions: result.effectivePermissions || result.user.permissions,
          },
          effectivePermissions: result.effectivePermissions || [],
        },
        'Đăng nhập thành công'
      );
    } catch (err) {
      const identifier = req.body?.identifier || req.body?.email || req.body?.phone;
      const ip = this._clientIp(req);
      const audit = err && err.audit;

      if (err?.statusCode === 401 && audit && !audit.skip) {
        const lock = LoginAttemptGuard.recordFailure(identifier, ip);
        if (lock.suggestChangePassword) {
          err.message = `${err.message} Bạn đã sai ${lock.failCount} lần — nên đổi mật khẩu. Vui lòng đợi ${lock.waitSeconds}s rồi thử lại.`;
          err.details = {
            ...(err.details || {}),
            failCount: lock.failCount,
            waitSeconds: lock.waitSeconds,
            remainingMs: lock.remainingMs,
            suggestChangePassword: true,
          };
        }
      }

      if (audit && audit.userExists && audit.user) {
        trackLoginFailed(req, {
          user: audit.user,
          reason: audit.reason || 'WRONG_PASSWORD',
        }).catch((e) =>
          console.error('[AuthController] trackLoginFailed error:', e.message)
        );
      } else if (!audit || !audit.skip) {
        try {
          const { auditLog, ACTION_TYPES } = require('../../utils/auditHelper');
          const id = identifier || 'unknown';
          await auditLog({
            req,
            action: ACTION_TYPES.FAILED_LOGIN,
            tableName: 'login_sessions',
            entityName: 'Đăng nhập thất bại',
            entityCode: String(id).slice(0, 128),
            description: `Đăng nhập thất bại: ${id}${audit?.reason ? ` — ${audit.reason}` : ''}`,
            responseStatus: err.statusCode || 401,
          });
        } catch (auditErr) {
          console.warn('[AuthController] failed-login audit (unknown user) failed:', auditErr.message);
        }
      }
      next(err);
    }
  }

  async getPendingLogin(req, res, next) {
    try {
      const status = this.authService.getPendingStatus(req.params.pendingId);
      return success(res, status, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async listMyLoginChallenges(req, res, next) {
    try {
      const userId = req.user?.userId || req.user?.id;
      const items = this.authService.listPendingChallengesForUser(userId);
      return success(res, { items }, 'OK');
    } catch (err) {
      next(err);
    }
  }

  async approvePendingLogin(req, res, next) {
    try {
      const userId = req.user?.userId || req.user?.id;
      const pendingId = req.params.pendingId || req.body?.pendingId;
      const row = await this.authService.approvePendingLogin(userId, pendingId);

      try {
        const { auditLog } = require('../../utils/auditHelper');
        const { buildAuditDescription } = require('../../utils/auditLabels');
        const meta = row?.clientMeta || {};
        await auditLog({
          req,
          action: 'APPROVE_LOGIN_CHALLENGE',
          tableName: 'login_sessions',
          entityName: 'Xác nhận đăng nhập thiết bị khác',
          entityCode: String(pendingId).slice(0, 64),
          description: buildAuditDescription('APPROVE_LOGIN_CHALLENGE', meta),
          newValue: { pendingId, status: 'approved', ...meta },
          responseStatus: 200,
        });
      } catch (e) {
        console.warn('[AuthController] audit APPROVE_LOGIN_CHALLENGE failed:', e.message);
      }

      return success(res, { pendingId: row.id, status: row.status }, 'Đã đồng ý cho thiết bị mới đăng nhập');
    } catch (err) {
      next(err);
    }
  }

  async rejectPendingLogin(req, res, next) {
    try {
      const userId = req.user?.userId || req.user?.id;
      const pendingId = req.params.pendingId || req.body?.pendingId;
      const row = await this.authService.rejectPendingLogin(userId, pendingId);

      try {
        const { auditLog } = require('../../utils/auditHelper');
        const { buildAuditDescription } = require('../../utils/auditLabels');
        const meta = row?.clientMeta || {};
        await auditLog({
          req,
          action: 'REJECT_LOGIN_CHALLENGE',
          tableName: 'login_sessions',
          entityName: 'Từ chối đăng nhập thiết bị khác',
          entityCode: String(pendingId).slice(0, 64),
          description: buildAuditDescription('REJECT_LOGIN_CHALLENGE', meta),
          newValue: { pendingId, status: 'rejected', ...meta },
          responseStatus: 200,
        });
      } catch (e) {
        console.warn('[AuthController] audit REJECT_LOGIN_CHALLENGE failed:', e.message);
      }

      return success(res, { pendingId: row.id, status: row.status }, 'Đã từ chối đăng nhập từ thiết bị mới');
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const email = req.body?.email;
      const result = await this.passwordResetService.requestReset(email, { ip: req.ip });

      try {
        const { auditLog: writeAudit } = require('../../utils/auditHelper');
        await writeAudit({
          req,
          action: 'UPDATE',
          tableName: 'password_reset_tokens',
          description: `Yêu cầu quên mật khẩu: ${String(email || '').slice(0, 64)}`,
          responseStatus: 200,
        });
      } catch (_) { /* non-blocking */ }

      return success(res, {
        sent: result.sent,
        mode: result.mode || null,
        ...(result.emailPreviewUrl ? { emailPreviewUrl: result.emailPreviewUrl } : {}),
        ...(result.devResetUrl ? { devResetUrl: result.devResetUrl } : {}),
        ...(result.mailError ? { mailError: result.mailError } : {}),
      }, result.message);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword, password } = req.body || {};
      const pwd = newPassword || password;
      const result = await this.passwordResetService.resetPassword(token, pwd);

      try {
        await this.notificationService.notify('PASSWORD_CHANGED', {
          userId: result.userId,
        }, { skipSettings: true });
      } catch (e) {
        console.warn('[AuthController] notify PASSWORD_CHANGED failed:', e.message);
      }

      try {
        await auditCrud.changePassword(req, {
          targetUserName: `user#${result.userId}`,
        });
      } catch (_) { /* non-blocking */ }

      return success(res, { userId: result.userId }, result.message);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      const userId = req.user?.userId || req.user?.id;
      let effectivePermissions = Array.isArray(req.user?.permissions)
        ? req.user.permissions
        : [];
      if (userId) {
        try {
          const full = await this._getPermissionService().getUserPermissions(userId, {
            skipCache: true,
          });
          effectivePermissions = Array.from(full);
        } catch (permErr) {
          console.warn('[AuthController.getMe] load full permissions failed:', permErr.message);
        }
      }
      return success(
        res,
        {
          ...req.user,
          permissions: effectivePermissions,
          jwtPermissions: req.user?.permissions || [],
        },
        'Lấy thông tin thành công'
      );
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
