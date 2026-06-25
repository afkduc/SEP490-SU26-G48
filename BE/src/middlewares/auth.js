const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const config = require('../config');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Chưa đăng nhập'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch {
    next(new ApiError(401, 'Token không hợp lệ hoặc đã hết hạn'));
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Chưa đăng nhập'));
    const hasRole = req.user.roles?.some((r) => roles.includes(r));
    if (!hasRole) return next(new ApiError(403, 'Không có quyền truy cập'));
    next();
  };
}

module.exports = { authenticate, authorize };
