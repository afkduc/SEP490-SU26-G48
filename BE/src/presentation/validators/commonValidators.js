const ApiError = require('../../utils/ApiError');
const { parsePositiveInt } = require('../../utils/fieldValidation');

/**
 * Middleware: param path phải là số nguyên dương.
 * @param {string} paramName - tên param (id | userId | roleId | deviceId ...)
 */
function validateIdParam(paramName = 'id') {
  return (req, res, next) => {
    try {
      const raw = req.params[paramName];
      const id = parsePositiveInt(raw);
      if (id === null) {
        throw new ApiError(400, `${paramName} phải là số nguyên dương`);
      }
      req.params[paramName] = String(id);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validateIdParam };
