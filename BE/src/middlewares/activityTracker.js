const DeviceService = require('../application/services/DeviceService');

const deviceService = new DeviceService();

// Paths that should NOT track as user activity
const EXCLUDED_PATHS = [
  // SSE / Realtime
  '/sse',
  '/events',
  '/socket',
  
  // Health checks
  '/health',
  '/ping',
  
  // Static resources
  '/favicon.ico',
  '/static',
  '/assets',
  '/images',
  '/css',
  '/js',
  
  // Debug endpoints
  '/_debug',
];

// Check if path should be excluded from activity tracking
function isExcludedPath(path) {
  return EXCLUDED_PATHS.some(excluded => path.startsWith(excluded));
}

/**
 * Middleware to track user activity.
 * Updates last_activity_at in DB with 60s throttle.
 * Does NOT emit SSE events (only login/logout/force do).
 */
function trackActivity(req, res, next) {
  // Only track if user is authenticated and has deviceId
  if (!req.user || !req.user.deviceId) {
    return next();
  }

  // Skip excluded paths
  if (isExcludedPath(req.path)) {
    return next();
  }

  // Fire and forget - don't block the request
  deviceService.updateLastActivity(req.user.deviceId)
    .catch((err) => {
      console.error('[activityTracker] Failed to update last_activity:', err.message);
    });

  next();
}

module.exports = { trackActivity };
