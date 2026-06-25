module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: '/api',
  jwtSecret: process.env.JWT_SECRET || 'autogara_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  db: {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'AutoGaraDB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
      encrypt: false,
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },
};
