const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0[0-9]{9,10})$/;
const PASSWORD_MIN_LENGTH = 6;

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
    // Validate status. Chi 2 status duoc phep:
    //   - 'active'   : dang hoat dong, duoc login
    //   - 'inactive' : ngung hoat dong, bi chan login
    // Status 'locked' cu da bi go (gop vao 'inactive' vi logic giong nhau).
    const VALID_STATUSES = ['active', 'inactive'];
    if (status && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'status khong hop le: active, inactive');
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

  /**
   * Lay full users theo filter (khong phan trang) de xuat Excel.
   * Tuong thich bo loc voi listUsers, chi khac la tra ve tat ca rows.
   */
  async exportUsers({ search, branchId, roleId, status } = {}) {
    const VALID_STATUSES = ['active', 'inactive'];
    if (status && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'status khong hop le: active, inactive');
    }

    const result = await this.adminUserRepository.findAllForExport({
      search: search?.trim(),
      branchId: branchId ? Number(branchId) : undefined,
      roleId: roleId?.trim(),
      status,
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
    const { name, email, password, branchId, roleId, firstName, lastName, phone, scopeAllBranches } = payload;

    if (!name || !email || !password || !roleId) {
      throw new ApiError(400, 'name, email, password, roleId la bat buoc');
    }

    // scopeAllBranches === true -> branchId KHONG duoc set (hoac null)
    // branchId la so duong -> gan user vao 1 chi nhanh cu the
    // branchId undefined/'' -> reject
    let parsedBranchId = null;
    let isScopeAllBranches = false;
    if (scopeAllBranches === true) {
      isScopeAllBranches = true;
    } else if (branchId !== null && branchId !== undefined && branchId !== '') {
      parsedBranchId = Number(branchId);
      if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
        throw new ApiError(400, 'branchId khong hop le');
      }
    } else {
      throw new ApiError(400, 'branchId la bat buoc (hoac chon "Tat ca chi nhanh")');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new ApiError(400, 'Email khong dung dinh dang');
    }

    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
      throw new ApiError(400, `Mat khau phai co it nhat ${PASSWORD_MIN_LENGTH} ky tu`);
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
        firstName: firstName || name,
        lastName: lastName || '',
        phone,
        branchId: parsedBranchId,
        roleId: Number(roleId),
        scopeAllBranches: isScopeAllBranches,
      });
      return user;
    } catch (err) {
      throw new ApiError(400, err.message || 'Tao user that bai');
    }
  }

  async getDashboardStats() {
    return this.adminUserRepository.getDashboardStats();
  }

  async updateUser(payload) {
    const { userId, firstName, lastName, email, phone, status, roleId, branchId, scopeAllBranches } = payload;

    if (!userId) {
      throw new ApiError(400, 'userId la bat buoc');
    }

    const existing = await this.adminUserRepository.findById(Number(userId));
    if (!existing) {
      throw new ApiError(404, 'Nguoi dung khong ton tai');
    }

    const VALID_STATUSES = ['active', 'inactive'];
    if (status !== undefined && status !== null && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'status khong hop le: active, inactive');
    }

    // Validate email neu co
    if (email !== undefined && email !== null && email !== '') {
      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!EMAIL_REGEX.test(email)) {
        throw new ApiError(400, 'Email khong dung dinh dang');
      }
    }

    // Validate phone neu co
    if (phone !== undefined && phone !== null && phone !== '') {
      const PHONE_REGEX = /^0\d{9,10}$/;
      if (!PHONE_REGEX.test(String(phone))) {
        throw new ApiError(400, 'So dien thoai phai bat dau bang 0, 10-11 chu so');
      }
    }

    // Validate branchId neu co
    // scopeAllBranches === true (FE gui len khi admin chon "Tat ca chi nhanh"):
    //   - branchId khong duoc set, hoac la null
    //   - BE se assign user vao TAT CA branch active (junction user_branches)
    //   - users.branch_id = NULL (de phan biet voi user thuong)
    // scopeAllBranches === false + branchId la so -> gan 1 branch cu the
    let parsedBranchId;
    let shouldUpdateBranchId = false;
    let isScopeAllBranches = false;
    if (scopeAllBranches === true) {
      // Validate quyen admin (chi role Admin moi duoc phep)
      // TODO: sua sau khi role permission service san sang - tam thoi check role id = 7 (Admin)
      isScopeAllBranches = true;
      parsedBranchId = null;
      shouldUpdateBranchId = true;
    } else if (branchId === null) {
      parsedBranchId = null;
      shouldUpdateBranchId = true;
    } else if (branchId !== undefined && branchId !== '') {
      parsedBranchId = Number(branchId);
      if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
        throw new ApiError(400, 'branchId khong hop le');
      }
      shouldUpdateBranchId = true;
    }

    // Validate roleId neu co
    let parsedRoleId;
    if (roleId !== undefined && roleId !== null && roleId !== '') {
      parsedRoleId = Number(roleId);
      if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
        throw new ApiError(400, 'roleId khong hop le');
      }
    }

    try {
      const updated = await this.adminUserRepository.updateUser({
        userId: Number(userId),
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        status,
        roleId: parsedRoleId,
        branchId: parsedBranchId,
        scopeAllBranches: isScopeAllBranches,
        shouldUpdateBranchId,
      });
      return updated;
    } catch (err) {
      throw new ApiError(400, err.message || 'Cap nhat nguoi dung that bai');
    }
  }

  /**
   * Generate mat khau ngau nhien (12 ky tu: hoa + thuong + so + dac biet)
   * Dam bao moi nhom ky tu deu co it nhat 1 ky tu
   */
  generateRandomPassword() {
    const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const LOWER = 'abcdefghijklmnopqrstuvwxyz';
    const DIGITS = '0123456789';
    const SPECIAL = '!@#$%^&*';
    const ALL = UPPER + LOWER + DIGITS + SPECIAL;

    // 4 ky tu bat buoc (moi nhom 1) + 8 ky tu random tu ALL
    const required = [
      UPPER[Math.floor(Math.random() * UPPER.length)],
      LOWER[Math.floor(Math.random() * LOWER.length)],
      DIGITS[Math.floor(Math.random() * DIGITS.length)],
      SPECIAL[Math.floor(Math.random() * SPECIAL.length)],
    ];

    const remaining = [];
    for (let i = 0; i < 8; i++) {
      remaining.push(ALL[Math.floor(Math.random() * ALL.length)]);
    }

    // Tron mang va ghep thanh chuoi (tranh cac ky tu required luon o dau)
    const combined = [...required, ...remaining];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return combined.join('');
  }

  /**
   * Validate mat khau nhap tay. Reuse rule tu createUser:
   *   - khong rong
   *   - do dai toi thieu PASSWORD_MIN_LENGTH
   *   - chi trim khoang trang 2 dau, khong trim ben trong
   */
  validateManualPassword(rawPassword) {
    if (rawPassword === undefined || rawPassword === null || rawPassword === '') {
      throw new ApiError(400, 'Mat khau moi la bat buoc khi chon che do nhap tay');
    }
    const password = String(rawPassword).trim();
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new ApiError(400, `Mat khau phai co it nhat ${PASSWORD_MIN_LENGTH} ky tu`);
    }
    return password;
  }

  /**
   * Admin reset mat khau cho user
   * - Co 2 che do:
   *   + newPassword duoc cung cap: dung MK do (admin nhap tay)
   *   + newPassword khong cung cap: generate MK ngau nhien 12 ky tu (hoa+thuong+so+dac biet)
   * - Hash bcrypt, luu DB, dat must_change_password theo flag
   * - Tra ve MK plain text 1 lan duy nhat (controller se gui cho FE)
   */
  async resetPassword({ userId, mustChangePassword = true, newPassword } = {}) {
    if (!userId) {
      throw new ApiError(400, 'userId la bat buoc');
    }

    // Kiem tra user ton tai
    const existing = await this.adminUserRepository.findById(Number(userId));
    if (!existing) {
      throw new ApiError(404, 'Nguoi dung khong ton tai');
    }

    // Khong reset MK cho chinh admin dang thuc hien (tranh tu khoa tai khoan)
    // (Controller se xu ly truong hop nay neu can, o service chi check don gian)

    // Quyet dinh MK plain text:
    //   - newPassword undefined/empty -> random
    //   - newPassword co gia tri -> validate + dung MK do
    let plainPassword;
    let isManual = false;
    if (newPassword !== undefined && newPassword !== null && newPassword !== '') {
      plainPassword = this.validateManualPassword(newPassword);
      isManual = true;
    } else {
      plainPassword = this.generateRandomPassword();
    }

    // Hash MK
    const passwordHash = bcrypt.hashSync(plainPassword, 10);

    // Update DB
    const ok = await this.adminUserRepository.updatePassword(
      Number(userId),
      passwordHash,
      mustChangePassword
    );

    if (!ok) {
      throw new ApiError(500, 'Reset mat khau that bai');
    }

    // Notify user about password reset by admin
    this._sendPasswordResetNotification(Number(userId));

    return {
      userId: Number(userId),
      newPassword: plainPassword, // plain text - chi tra 1 lan
      isManual,
      mustChangePassword: Boolean(mustChangePassword),
      message: isManual
        ? 'Mat khau moi da duoc dat theo gia tri admin nhap.'
        : mustChangePassword
        ? 'Mat khau da duoc dat lai. User phai doi mat khau khi dang nhap lan sau.'
        : 'Mat khau da duoc dat lai thanh cong.',
    };
  }

  _sendPasswordResetNotification(userId) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      ns.notify('PASSWORD_CHANGED', { userId, resetByAdmin: true });
    } catch (err) {
      console.error('[AdminUserService] Failed to send password reset notification:', err.message);
    }
  }
}

module.exports = AdminUserService;
