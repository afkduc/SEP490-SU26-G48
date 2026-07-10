const ApiError = require('../../utils/ApiError');

class AdminUserService {
  constructor({ adminUserRepository }) {
    this.adminUserRepository = adminUserRepository;
  }

  async listUsers({ search, branchId, roleId, status, page, pageSize }) {
    // Parse & validate pagination
    const parsedPage = parseInt(page, 10) || 1;
    const parsedPageSize = parseInt(pageSize, 10) || 10;

    if (parsedPage < 1) throw new ApiError(400, 'page phai >= 1');
    if (parsedPageSize < 1 || parsedPageSize > 100) {
      throw new ApiError(400, 'pageSize phai tu 1 den 100');
    }

    // Validate status
    const VALID_STATUSES = ['active', 'inactive', 'locked'];
    if (status && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'status khong hop le: active, inactive, locked');
    }

    const result = await this.adminUserRepository.findAll({
      search: search?.trim(),
      branchId: branchId ? Number(branchId) : undefined,
      roleId: roleId?.trim(),
      status,
      page: parsedPage,
      pageSize: parsedPageSize,
    });

    return result;
  }

  async listBranches() {
    const branches = await this.adminUserRepository.findAllBranches();
    return { items: branches, total: branches.length };
  }
}

module.exports = AdminUserService;
