const app = require('./app');
const loginSessionJob = require('./jobs/loginSessionCleanupJob');
const { bootSync: bootPermissionMatrixSync } = require('./application/services/permissionMatrixSyncService');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📝 API Health: http://localhost:${PORT}/api/health`);
  console.log(`👋 Hello World: http://localhost:${PORT}/api/hello`);
  // Khoi dong job cleanup cac phien stale + backfill browser/os
  loginSessionJob.start();
  // Auto-sync L1 (screen:X:Y:access) theo L2 (role_screen_permissions) cho
  // tat ca role. Idempotent, chi thay doi neu data inconsistent. Dam bao
  // moi thanh vien trong team khong can chay SQL thu cong.
  bootPermissionMatrixSync();
});
