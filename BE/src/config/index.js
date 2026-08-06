module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: '/api',
  jwtSecret: process.env.JWT_SECRET || 'autogara_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  /** TTL khi tick «Ghi nhớ đăng nhập» (localStorage). */
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  /**
   * FE URLs cho link email (quen MK, PayOS return,...).
   * - Local: khong /crm  → http://localhost:3000
   * - Prod:  co /crm     → https://www.autogara.site/crm
   * FRONTEND_TARGET=local|prod chon URL chinh (nut trong email).
   * FRONTEND_INCLUDE_BOTH_LINKS=true → email ghi ca 2 link de test.
   * FRONTEND_URL (cu) van dung neu khong set LOCAL/PROD.
   */
  frontendUrlLocal: (process.env.FRONTEND_URL_LOCAL || 'http://localhost:3000').replace(/\/$/, ''),
  frontendUrlProd: (process.env.FRONTEND_URL_PROD || 'https://www.autogara.site/crm').replace(/\/$/, ''),
  frontendTarget: String(process.env.FRONTEND_TARGET || 'local').toLowerCase() === 'prod' ? 'prod' : 'local',
  frontendIncludeBothLinks: process.env.FRONTEND_INCLUDE_BOTH_LINKS === 'true',
  get frontendUrl() {
    if (process.env.FRONTEND_URL) {
      return String(process.env.FRONTEND_URL).replace(/\/$/, '');
    }
    return this.frontendTarget === 'prod' ? this.frontendUrlProd : this.frontendUrlLocal;
  },
  mail: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@autogara.vn',
    allowEthereal: process.env.SMTP_ALLOW_ETHEREAL !== 'false',
  },
  passwordResetExpiresMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 5),
  payos: {
    clientId: process.env.PAYOS_CLIENT_ID || '',
    apiKey: process.env.PAYOS_API_KEY || '',
    checksumKey: process.env.PAYOS_CHECKSUM_KEY || '',
  },
  db: {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'AutoGaraDB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },
};
