const express = require('express');
const http = require('http');
const cors = require('cors');
require('./config/env');

const config = require('./config');
const routes = require('./presentation/routes');
const { logger, errorHandler } = require('./middlewares');
const { getPool } = require('./infrastructure/database/sqlServer');
const { makeMaintenanceReminderRepository } = require('./infrastructure/repositories');

const MAINTENANCE_REMINDER_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 gio/lan

// Tu dong sinh nhac nho bao duong tu next_maintenance_km/date cua phieu quyet
// toan gan nhat - chay 1 lan luc khoi dong roi lap lai dinh ky, khong lam
// gian doan server neu loi (chi log).
async function syncMaintenanceReminders() {
  try {
    await makeMaintenanceReminderRepository().syncFromServiceOrders();
  } catch (err) {
    console.error('[maintenanceReminders] sync failed:', err.message);
  }
}

const app = express();

// CORS config - phai la origin string khi credentials=true
// CORS_ORIGIN: danh sach origin duoc phep, phan cach boi dau phay - cho phep
// them origin thuc te khi deploy (IP/domain server) ma khong phai sua code,
// mac dinh giu nguyen 2 origin dev cu neu khong set.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

app.use(config.apiPrefix, routes);

app.use(errorHandler);

async function start() {
  try {
    await getPool();

    // Start background jobs
    try {
      require('./jobs/securityAlertJob').start();
      require('./jobs/auditRetentionJob').start();
      require('./jobs/loginSessionCleanupJob').start();
    } catch (jobErr) {
      console.warn('[BE] Failed to start background jobs:', jobErr.message);
    }

    const server = http.createServer({ maxHeaderSize: 32768 }, app);
    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
    });

    // Keep timeouts reasonable for dev/prod
    server.headersTimeout = 60000;
    server.requestTimeout = 60000;

    syncMaintenanceReminders();
    setInterval(syncMaintenanceReminders, MAINTENANCE_REMINDER_SYNC_INTERVAL_MS);
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();



