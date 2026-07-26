/**
 * EmailService — gửi email qua SMTP (Gmail App Password) hoặc Ethereal (dev).
 *
 * Ưu tiên:
 *   1. SMTP_USER + SMTP_PASS trong .env → Gmail/SMTP thật
 *   2. SMTP_ALLOW_ETHEREAL=true (mặc định dev) → tài khoản test Ethereal
 *   3. Không cấu hình → không gửi, chỉ log
 */
const config = require('../../config');

class EmailService {
  constructor() {
    this._transporter = null;
    this._mode = null; // 'smtp' | 'ethereal' | null
  }

  isConfigured() {
    return Boolean(config.mail?.user && config.mail?.pass);
  }

  allowEthereal() {
    if (config.mail?.allowEthereal === false) return false;
    if (process.env.SMTP_ALLOW_ETHEREAL === 'false') return false;
    return config.nodeEnv !== 'production' || process.env.SMTP_ALLOW_ETHEREAL === 'true';
  }

  async _loadNodemailer() {
    try {
      return require('nodemailer');
    } catch (e) {
      console.warn('[EmailService] Chưa cài nodemailer. Trong thư mục BE chạy: npm install nodemailer');
      return null;
    }
  }

  async _getTransporter() {
    if (this._transporter) return this._transporter;

    const nodemailer = await this._loadNodemailer();
    if (!nodemailer) return null;

    // 1) SMTP thật (Gmail…)
    if (this.isConfigured()) {
      this._transporter = nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.secure,
        auth: {
          user: config.mail.user,
          pass: config.mail.pass,
        },
      });
      this._mode = 'smtp';
      try {
        await this._transporter.verify();
        console.log(`[EmailService] SMTP sẵn sàng (${config.mail.user} @ ${config.mail.host})`);
      } catch (err) {
        console.error('[EmailService] SMTP verify thất bại:', err.message);
        this._transporter = null;
        this._mode = null;
        // fall through to ethereal nếu được phép
      }
      if (this._transporter) return this._transporter;
    }

    // 2) Ethereal (dev / test)
    if (this.allowEthereal()) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this._transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this._mode = 'ethereal';
        console.log('[EmailService] Dùng Ethereal (dev). User:', testAccount.user);
        return this._transporter;
      } catch (err) {
        console.error('[EmailService] Không tạo được Ethereal account:', err.message);
      }
    }

    console.warn('[EmailService] Chưa cấu hình SMTP. Điền SMTP_USER/SMTP_PASS trong BE/.env');
    return null;
  }

  /**
   * @returns {Promise<{ sent: boolean, mode?: string, previewUrl?: string, preview?: string, error?: string }>}
   */
  async sendMail({ to, subject, html, text }) {
    const nodemailer = await this._loadNodemailer();
    const transporter = await this._getTransporter();
    if (!transporter) {
      console.warn('[EmailService] Không gửi được email — SMTP/Ethereal chưa sẵn sàng.');
      console.warn(`[EmailService] To: ${to} | Subject: ${subject}`);
      if (text) console.warn(`[EmailService] Body:\n${text}`);
      return { sent: false, preview: text || html };
    }

    try {
      const info = await transporter.sendMail({
        from: this._mode === 'ethereal'
          ? `"AutoGara Dev" <${transporter.options.auth.user}>`
          : (config.mail.from || config.mail.user),
        to,
        subject,
        html,
        text: text || undefined,
      });

      let previewUrl = null;
      if (nodemailer.getTestMessageUrl) {
        previewUrl = nodemailer.getTestMessageUrl(info) || null;
      }
      if (previewUrl) {
        console.log('[EmailService] Xem email test:', previewUrl);
      }

      return { sent: true, mode: this._mode, previewUrl };
    } catch (err) {
      console.error('[EmailService] Gửi mail lỗi:', err.message);
      return { sent: false, error: err.message, preview: text || html };
    }
  }

  async sendPasswordResetEmail({ to, userName, resetUrl, expiresMinutes }) {
    const subject = 'AutoGara — Xác nhận đổi mật khẩu';
    const text =
      `Xin chào ${userName || ''},\n\n`
      + `Bạn đã yêu cầu đổi mật khẩu tài khoản AutoGara.\n`
      + `Để xác nhận và đặt mật khẩu mới, mở liên kết sau trong ${expiresMinutes} phút:\n`
      + `${resetUrl}\n\n`
      + `Nếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu hiện tại vẫn giữ nguyên.\n`;

    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;line-height:1.5">
        <h2 style="margin:0 0 12px;color:#111827">Xác nhận đổi mật khẩu</h2>
        <p>Xin chào <strong>${userName || 'bạn'}</strong>,</p>
        <p>
          Chúng tôi nhận được yêu cầu <strong>đổi mật khẩu</strong> cho tài khoản AutoGara
          gắn với email này. Nhấn nút bên dưới để xác nhận và chuyển đến trang đặt mật khẩu mới.
        </p>
        <p style="margin:28px 0">
          <a href="${resetUrl}"
             style="display:inline-block;background:#111827;color:#fff;text-decoration:none;
                    padding:14px 22px;border-radius:8px;font-weight:600">
            Xác nhận &amp; đặt mật khẩu mới
          </a>
        </p>
        <p style="font-size:13px;color:#64748b">
          Liên kết có hiệu lực trong <strong>${expiresMinutes} phút</strong> và chỉ dùng được một lần.
          Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại không đổi.
        </p>
        <p style="font-size:12px;color:#94a3b8;word-break:break-all;margin-top:20px">
          Không bấm được nút? Copy link:<br/>${resetUrl}
        </p>
      </div>
    `;

    return this.sendMail({ to, subject, html, text });
  }
}

module.exports = EmailService;
