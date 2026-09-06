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

// Tu dong sinh 3 moc nhac nho bao duong (1 tuan/1 thang/2 thang tinh tu ngay
// tao phieu) cho tung phieu quyet toan - chay 1 lan luc khoi dong roi lap lai
// dinh ky, khong lam gian doan server neu loi (chi log).
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
const allowedOrigins = (process.env.CORS_ORIGIN || [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Vite tự nhảy port khi 3000 bận (vd npm run dev → 3001)
  'http://localhost:3001',
  'http://127.0.0.1:3001',
].join(','))
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
// Default 100kb qua nho - anh chu ky dien tu (base64 PNG, xem SignaturePad.jsx)
// thuong lon hon muc nay.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
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

    // Dam bao cot thiet bi tren login_sessions (da gop bo user_devices)
    try {
      await require('./infrastructure/repositories/DeviceRepository').ensureSessionDeviceSchema();
      console.log('[BE] login_sessions device columns ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureSessionDeviceSchema:', schemaErr.message);
    }

    // PHAI chay TRUOC cac buoc ensure* khac vi no doi ten bang
    // (service_orders -> repair_orders, service_order_items ->
    // repair_order_items) - cac buoc sau deu tham chieu ten MOI.
    //
    // Va KHAC cac buoc ensure* o duoi: doi ten bang/cot chu khong chi them
    // cot, nen KHONG duoc nuot loi. Neu no hong (da rollback) thi schema van
    // la ban cu trong khi code da la ban moi - chay tiep chi tao ra loi 500
    // kho hieu o khap noi. Dung han cho de con biet duong sua.
    try {
      const { ensureRepairOrderMerge } = require('./infrastructure/database/ensureRepairOrderMerge');
      const result = await ensureRepairOrderMerge();
      console.log(result.skipped
        ? '[BE] repair_orders merge: da gop tu truoc, bo qua'
        : `[BE] repair_orders merge: DA GOP XONG (${result.steps} buoc)`);
    } catch (mergeErr) {
      console.error('[BE] KHONG THE KHOI DONG - gop bang repair_orders that bai:');
      console.error(mergeErr.message);
      process.exit(1);
    }

    // Dat lai ten rang buoc/index cho khop ten bang moi - THUAN THAM MY, hong
    // cung khong sao nen chi canh bao (khac buoc gop bang o tren).
    try {
      const { ensureRepairOrderConstraintNames } = require('./infrastructure/database/ensureRepairOrderConstraintNames');
      const r = await ensureRepairOrderConstraintNames();
      if (r.renamed > 0) console.log(`[BE] doi ten ${r.renamed} rang buoc/index cho khop bang repair_orders`);
    } catch (nameErr) {
      console.warn('[BE] ensureRepairOrderConstraintNames:', nameErr.message);
    }

    // Bo bang `brands` (chi con Mazda) - doi cot nen KHONG duoc nuot loi:
    // hong ma van chay tiep thi code moi (da bo brand_id) gap schema cu se
    // loi kho hieu. Dung han cho de con biet duong sua.
    try {
      const { ensureDropBrands } = require('./infrastructure/database/ensureDropBrands');
      const r = await ensureDropBrands();
      console.log(r.skipped
        ? '[BE] brands: da bo tu truoc, bo qua'
        : `[BE] brands: DA BO XONG (${r.steps} buoc)`);
    } catch (brandErr) {
      console.error('[BE] KHONG THE KHOI DONG - bo bang brands that bai:');
      console.error(brandErr.message);
      process.exit(1);
    }

    // Bo 5 cot chet cua vehicle_models - doi cot nen KHONG duoc nuot loi,
    // giong ensureDropBrands: code moi da bo cac cot nay khoi cau SELECT.
    try {
      const { ensureTrimVehicleModelColumns } = require('./infrastructure/database/ensureTrimVehicleModelColumns');
      const r = await ensureTrimVehicleModelColumns();
      console.log(r.skipped
        ? '[BE] vehicle_models: cot chet da bo tu truoc, bo qua'
        : `[BE] vehicle_models: DA BO 5 COT CHET (${r.steps} buoc)`);
    } catch (trimErr) {
      console.error('[BE] KHONG THE KHOI DONG - bo cot chet vehicle_models that bai:');
      console.error(trimErr.message);
      process.exit(1);
    }

    try {
      await require('./infrastructure/database/ensureAuditLogsUnicode').ensureAuditLogsUnicodeColumns();
      console.log('[BE] audit_logs unicode columns ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureAuditLogsUnicodeColumns:', schemaErr.message);
    }

    try {
      await require('./infrastructure/database/ensureInventoryRequestUnicode').ensureInventoryRequestUnicode();
      console.log('[BE] inventory request unit columns ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureInventoryRequestUnicode:', schemaErr.message);
    }

    try {
      await require('./infrastructure/database/ensureRepairOrderTasksColumns').ensureRepairOrderTasksColumns();
      console.log('[BE] repair_order_tasks/repair_order_items note+prev_quantity columns ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureRepairOrderTasksColumns:', schemaErr.message);
    }

    try {
      await require('./infrastructure/database/ensureInvoicePaymentMethod').ensureInvoicePaymentMethod();
      console.log('[BE] invoices.payment_method column ready');
    } catch (schemaErr) {
      console.warn('[BE] ensureInvoicePaymentMethod:', schemaErr.message);
    }

    // Metadata goi bao duong dinh ky (doi xe cua goi, nhom + yeu cau thuc hien
    // I/R/M/V theo bieu mau "Phieu kiem tra BDDK"). KHONG duoc nuot loi: code
    // moi SELECT thang cac cot nay o catalog va o checklist to truong/khoang -
    // thieu cot la 500 o khap noi thay vi mat 1 tinh nang.
    try {
      const { ensureMaintenancePackageMeta } = require('./infrastructure/database/ensureMaintenancePackageMeta');
      const r = await ensureMaintenancePackageMeta();
      console.log(r.skipped
        ? '[BE] metadata goi bao duong: da co tu truoc, bo qua'
        : `[BE] metadata goi bao duong: DA THEM XONG (${r.steps} buoc)`);
    } catch (metaErr) {
      console.error('[BE] KHONG THE KHOI DONG - them metadata goi bao duong that bai:');
      console.error(metaErr.message);
      process.exit(1);
    }

    // Moc "khoang bao xong viec" - tach buoc khoang bao xong khoi buoc to
    // truong xac nhan hoan thanh. KHONG duoc nuot loi: thieu cot thi
    // repairStatusOf khong bao gio ra 'awaiting_confirmation' (nut Xac nhan
    // khong hien) va cau UPDATE cua reportBayCompleted se loi ten cot.
    try {
      const { ensureBayCompletionConfirm } = require('./infrastructure/database/ensureBayCompletionConfirm');
      const r = await ensureBayCompletionConfirm();
      console.log(r.skipped
        ? '[BE] moc xac nhan hoan thanh: da co tu truoc, bo qua'
        : `[BE] moc xac nhan hoan thanh: DA THEM XONG (${r.steps} buoc)`);
    } catch (confirmErr) {
      console.error('[BE] KHONG THE KHOI DONG - them moc xac nhan hoan thanh that bai:');
      console.error(confirmErr.message);
      process.exit(1);
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



