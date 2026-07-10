const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0[0-9]{9,10})$/;

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

  async listRoles() {
    const roles = await this.adminUserRepository.findAllRoles();
    return { items: roles, total: roles.length };
  }

  async getUserDetail(userId) {
    if (!userId) throw new ApiError(400, 'userId la bat buoc');
    const user = await this.adminUserRepository.findById(Number(userId));
    if (!user) throw new ApiError(404, 'Nguoi dung khong ton tai');
    return user;
  }

  async createUser(payload) {
    const { name, email, password, branchId, roleId, fullName, phone } = payload;

    if (!name || !email || !password || !branchId || !roleId) {
      throw new ApiError(400, 'name, email, password, branchId, roleId la bat buoc');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new ApiError(400, 'Email khong dung dinh dang');
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      throw new ApiError(400, 'So dien thoai phai bat dau bang 0, 10-11 chu so');
    }

    const existed = await this.adminUserRepository.findByEmail(email);
    if (existed) {
      throw new ApiError(409, 'Email da ton tai');
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    try {
      const user = await this.adminUserRepository.create({
        name,
        email,
        passwordHash,
        fullName: fullName || name,
        phone,
        branchId: Number(branchId),
        roleId: Number(roleId),
      });
      return user;
    } catch (err) {
      throw new ApiError(400, err.message || 'Tao user that bai');
    }
  }

  async updateUser(payload) {
    const { userId, status, roleId } = payload;

    if (!userId) {
      throw new ApiError(400, 'userId la bat buoc');
    }

    const existing = await this.adminUserRepository.findById(Number(userId));
    if (!existing) {
      throw new ApiError(404, 'Nguoi dung khong ton tai');
    }

    const VALID_STATUSES = ['active', 'inactive', 'locked'];
    if (status && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'status khong hop le: active, inactive, locked');
    }

    try {
      const updated = await this.adminUserRepository.updateUser({
        userId: Number(userId),
        status,
        roleId: roleId !== undefined ? (roleId ? Number(roleId) : null) : undefined,
      });
      return updated;
    } catch (err) {
      throw new ApiError(400, err.message || 'Cap nhat nguoi dung that bai');
    }
  }
}

module.exports = AdminUserService;
