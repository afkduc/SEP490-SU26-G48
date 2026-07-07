require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const errorHandler = require('./middlewares/errorHandler');
const apiRouter = require('./presentation/routes');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRouter);

// Error handling middleware
app.use(errorHandler);

module.exports = app;
