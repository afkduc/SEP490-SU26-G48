const logger = require('./logger');
const errorHandler = require('./errorHandler');
const { authenticate, authorize } = require('./auth');

module.exports = {
  logger,
  errorHandler,
  authenticate,
  authorize,
};
