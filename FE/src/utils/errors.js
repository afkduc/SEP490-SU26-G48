export function getErrorMessage(error, fallback = 'Đã xảy ra lỗi, vui lòng thử lại') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return fallback;
}

export function isApiError(error) {
  return Boolean(error && typeof error.status === 'number');
}
