const logger = require('./logger');
const errorHandler = require('./errorHandler');
const { authenticate, authorize, requireAdmin } = require('./auth');
const {
  requirePerm,
  requireAnyPerm,
  requireScreen,
  requireScreenAction,
  invalidateUserCache,
} = require('./permission');
const { trackActivity } = require('./activityTracker');

module.exports = {
  logger,
  errorHandler,
  authenticate,
  authorize,
  requireAdmin,
  requirePerm,
  requireAnyPerm,
  requireScreen,
  requireScreenAction,
  invalidateUserCache,
  trackActivity,
};
