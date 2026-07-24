const ApiError = require('../../utils/ApiError');

const VALID_STATUSES = ['active', 'inactive'];

/**
 * Validate query params cho GET /api/admin/users
 * - search    : chuoi (optional)
 * - branchId  : so nguyen duong (optional)
 * - roleId    : chuoi (optional)
 * - status    : active | inactive (optional)
 * - page      : so nguyen >= 1 (optional, mac dinh 1)
 * - pageSize  : so nguyen 1..100 (optional, mac dinh 10)
 */
function validateListUsersQuery(req, res, next) {
  try {
    const { search, branchId, roleId, status, page, pageSize } = req.query;

    if (search !== undefined && (typeof search !== 'string' || search.length > 100)) {
      throw new ApiError(400, 'search phai la chuoi (toi da 100 ky tu)');
    }

    if (branchId !== undefined) {
      const parsed = Number(branchId);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new ApiError(400, 'branchId phai la so nguyen duong');
      }
    }

    if (roleId !== undefined && (typeof roleId !== 'string' || roleId.length > 50)) {
      throw new ApiError(400, 'roleId phai la chuoi (toi da 50 ky tu)');
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, `status khong hop le (chi chap nhan: ${VALID_STATUSES.join(', ')})`);
    }

    if (page !== undefined) {
      const parsed = Number(page);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new ApiError(400, 'page phai la so nguyen >= 1');
      }
    }

    if (pageSize !== undefined) {
      const parsed = Number(pageSize);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new ApiError(400, 'pageSize phai la so nguyen tu 1 den 100');
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateListUsersQuery };