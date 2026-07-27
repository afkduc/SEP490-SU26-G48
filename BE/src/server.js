const app = require('./app');
const loginSessionJob = require('./jobs/loginSessionCleanupJob');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📝 API Health: http://localhost:${PORT}/api/health`);
  console.log(`👋 Hello World: http://localhost:${PORT}/api/hello`);
  // Khoi dong job cleanup cac phien stale + backfill browser/os
  loginSessionJob.start();
});
