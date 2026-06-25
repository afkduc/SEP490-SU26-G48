const ApiError = require('./ApiError');

function success(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function error(res, message = 'Server Error', statusCode = 500, errors = null) {
  if (message instanceof ApiError) {
    statusCode = message.statusCode;
    message = message.message;
  }
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}

module.exports = { success, error };
