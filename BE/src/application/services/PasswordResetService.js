/**
 * PasswordResetService — quên mật khẩu qua email (token 1 lần, hết hạn).
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../../config');
const { query } = require('../../infrastructure/database/sqlServer');
const EmailService = require('./EmailService');
const ApiError = require('../../utils/ApiError');

const GENERIC_MSG =
  'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi email xác nhận đổi mật khẩu. Vui lòng mở hộp thư và bấm liên kết để đặt mật khẩu mới.';

class PasswordResetService {
  constructor(authRepository) {
    this.authRepository = authRepository;
    this.emailService = new EmailService();
    this._tableReady = null;
  }

  async _ensureTable() {
    if (this._tableReady) return this._tableReady;
    this._tableReady = (async () => {
      // Tách 2 câu lệnh để tương thích driver mssql
      await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'password_reset_tokens')
        BEGIN
          CREATE TABLE password_reset_tokens (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash NVARCHAR(128) NOT NULL,
            expires_at DATETIME2 NOT NULL,
            used_at DATETIME2 NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_prt_created DEFAULT SYSUTCDATETIME()
          )
        END
      `);
      await query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes WHERE name = 'IX_prt_token_hash'
            AND object_id = OBJECT_ID('password_reset_tokens')
        )
        CREATE INDEX IX_prt_token_hash ON password_reset_tokens(token_hash)
      `);
      await query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes WHERE name = 'IX_prt_user_id'
            AND object_id = OBJECT_ID('password_reset_tokens')
        )
        CREATE INDEX IX_prt_user_id ON password_reset_tokens(user_id)
      `);
    })().catch((err) => {
      this._tableReady = null;
      throw err;
    });
    return this._tableReady;
  }

  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Luôn trả message chung (không lộ email có/không tồn tại).
   */
  async requestReset(email, { ip } = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new ApiError(400, 'Email không hợp lệ');
    }

    await this._ensureTable();

    const user = await this.authRepository.findUserByEmail(normalizedEmail);
    if (!user || (user.status && user.status !== 'active')) {
      return {
        message: 'Hiện tại tài khoản của bạn chưa được đăng ký trên hệ thống.',
        sent: false,
        registered: false,
        auditUserId: null,
        auditBranchId: null,
      };
    }

    // Vô hiệu token cũ chưa dùng
    await query(
      `UPDATE password_reset_tokens
       SET used_at = SYSUTCDATETIME()
       WHERE user_id = @p1 AND used_at IS NULL`,
      { p1: user.id }
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this._hashToken(rawToken);
    const expiresMinutes = config.passwordResetExpiresMinutes || 5;

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (@p1, @p2, DATEADD(MINUTE, @p3, SYSUTCDATETIME()))`,
      { p1: user.id, p2: tokenHash, p3: expiresMinutes }
    );

    const resetPath = `/reset-password?token=${rawToken}`;
    const resetUrlLocal = `${config.frontendUrlLocal}${resetPath}`;
    const resetUrlProd = `${config.frontendUrlProd}${resetPath}`;
    const resetUrl = `${config.frontendUrl}${resetPath}`;
    const includeBoth = config.frontendIncludeBothLinks
      && config.frontendUrlLocal !== config.frontendUrlProd;
    const userName =
      [user.first_name, user.last_name].filter(Boolean).join(' ')
      || user.user_name
      || user.email;

    const mailResult = await this.emailService.sendPasswordResetEmail({
      to: user.email,
      userName,
      resetUrl,
      resetUrlLocal: includeBoth ? resetUrlLocal : undefined,
      resetUrlProd: includeBoth ? resetUrlProd : undefined,
      expiresMinutes,
    });

    if (!mailResult.sent) {
      console.warn(
        `[PasswordReset] Chưa gửi được email — DEV reset link (userId=${user.id}, ip=${ip || 'n/a'}):\n`
        + `primary: ${resetUrl}\n`
        + (includeBoth ? `local: ${resetUrlLocal}\nprod: ${resetUrlProd}\n` : '')
      );
    } else if (mailResult.previewUrl) {
      console.log(`[PasswordReset] Ethereal preview: ${mailResult.previewUrl}`);
    }

    const mailConfigured = this.emailService.isConfigured();
    return {
      message: GENERIC_MSG,
      sent: Boolean(mailResult.sent),
      registered: true,
      mode: mailResult.mode || null,
      // Chi dung noi bo cho audit (controller khong dua ra response)
      auditUserId: user.id,
      auditBranchId: user.branch_id != null ? user.branch_id : null,
      // Dev helpers — không lộ token thô khi đã có preview Ethereal
      ...(config.nodeEnv !== 'production' && mailResult.previewUrl
        ? { emailPreviewUrl: mailResult.previewUrl }
        : {}),
      ...(config.nodeEnv !== 'production' && !mailResult.sent
        ? {
            devResetUrl: resetUrl,
            mailError: mailConfigured
              ? (mailResult.error || 'Gửi SMTP thất bại. Kiểm tra SMTP_PASS (App Password).')
              : 'Chưa cấu hình SMTP_USER/SMTP_PASS trong BE/.env — không gửi được Gmail thật.',
          }
        : {}),
    };
  }

  async resetPassword(token, newPassword) {
    const raw = String(token || '').trim();
    const password = String(newPassword || '');

    if (!raw) throw new ApiError(400, 'Token không hợp lệ');
    if (password.length < 6) throw new ApiError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');

    await this._ensureTable();
    const tokenHash = this._hashToken(raw);

    const result = await query(
      `SELECT TOP 1 id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = @p1
       ORDER BY id DESC`,
      { p1: tokenHash }
    );
    const row = result.recordset[0];
    if (!row) throw new ApiError(400, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    if (row.used_at) throw new ApiError(400, 'Liên kết này đã được sử dụng');
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new ApiError(400, 'Liên kết đặt lại mật khẩu đã hết hạn');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.authRepository.updatePassword(row.user_id, passwordHash);

    await query(
      `UPDATE password_reset_tokens SET used_at = SYSUTCDATETIME() WHERE id = @p1`,
      { p1: row.id }
    );

    // Invalidate mọi token reset còn lại của user
    await query(
      `UPDATE password_reset_tokens
       SET used_at = SYSUTCDATETIME()
       WHERE user_id = @p1 AND used_at IS NULL`,
      { p1: row.user_id }
    );

    return { userId: row.user_id, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.' };
  }
}

module.exports = PasswordResetService;
