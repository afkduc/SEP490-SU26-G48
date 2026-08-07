const ApiError = require('./ApiError');

function success(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function error(res, message = 'Server Error', statusCode = 500, errors = null, extra = null) {
  if (message instanceof ApiError) {
    statusCode = message.statusCode;
    message = message.message;
  }
  const body = {
    success: false,
    message,
    errors,
  };
  if (extra && typeof extra === 'object') {
    Object.assign(body, extra);
  }
  return res.status(statusCode).json(body);
}

module.exports = { success, error };
