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

const errorHandler = require('./middlewares/errorHandler');
const auditLogger = require('./middlewares/auditMiddleware');
const apiRouter = require('./presentation/routes');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Audit logger — runs BEFORE apiRouter so it can capture every request
app.use('/api', auditLogger);

// API routes
app.use('/api', apiRouter);

// Error handling middleware
app.use(errorHandler);

module.exports = app;
