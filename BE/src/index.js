const express = require('express');
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

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
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
    } catch (jobErr) {
      console.warn('[BE] Failed to start background jobs:', jobErr.message);
    }

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
    });

    syncMaintenanceReminders();
    setInterval(syncMaintenanceReminders, MAINTENANCE_REMINDER_SYNC_INTERVAL_MS);
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
