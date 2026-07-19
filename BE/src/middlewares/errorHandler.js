const { error } = require('../utils/response');
const ApiError = require('../utils/ApiError');

function errorHandler(err, req, res, next) {
  if (err instanceof ApiError && err.statusCode < 500) {
    console.warn(`[${err.statusCode}] ${req.method} ${req.originalUrl} - ${err.message}`);
  } else {
    console.error('Error:', err);
  }

  if (err instanceof ApiError) {
    return error(res, err.message, err.statusCode);
  }

  return error(res, err.message || 'Internal Server Error', 500);
}

module.exports = errorHandler;
