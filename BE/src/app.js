require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// TRUST PROXY:
//   - Neu trien khai qua nginx/cloudflare: dat TRUOC env truoc khi start
//     TRUST_PROXY=true de tu dong set tu env
//   - Neu trien khai truc tiep (localhost): dat 0 hoac khong set
//   - Moi truong hop, getRequestMeta() cung co fallback parse X-Forwarded-For
const TRUST_PROXY = process.env.TRUST_PROXY !== undefined
  ? process.env.TRUST_PROXY
  : 1;  // mac dinh tin 1 hop proxy
app.set('trust proxy', TRUST_PROXY);
console.log(`[app] trust proxy = ${TRUST_PROXY}`);

// Disable ETag for /api/* routes — tranh 304 cache hit tra ve data cu
// sau khi PUT/PATCH/DELETE thanh cong (browser se thay data moi chi khi F5).
// Crash-debug Bug #N: GET /api/admin/users tra 304 voi body cu sau khi PUT user.
app.set('etag', false);

const errorHandler = require('./middlewares/errorHandler');
const auditLogger = require('./middlewares/auditMiddleware');
const apiRouter = require('./presentation/routes');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set no-store cho toan bo /api/* de chan HTTP caching (browser + proxy)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Audit logger — runs BEFORE apiRouter so it can capture every request
app.use('/api', auditLogger);

// API routes
app.use('/api', apiRouter);

// Error handling middleware
app.use(errorHandler);

module.exports = app;
