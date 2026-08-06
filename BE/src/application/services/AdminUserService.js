const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');
const {
  EMAIL_HINT,
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isValidEmail,
  isValidPhone,
  phoneDigitsOnly,
  isValidUsername,
  isValidPassword,
} = require('../../utils/fieldValidation');

class AdminUserService {
  constructor({ adminUserRepository }) {
    this.adminUserRepository = adminUserRepository;
  }

  async assertActiveRole(roleId) {
    const role = await this.adminUserRepository.findRoleById(roleId);
    if (!role) throw new ApiError(400, `Vai trò id=${roleId} không tồn tại`);
    if (!role.isActive) throw new ApiError(400, `Vai trò "${role.roleName}" đang ngừng hoạt động`);
    return role;
  }

  async assertActiveBranch(branchId) {
    const branch = await this.adminUserRepository.findBranchById(branchId);
    if (!branch) throw new ApiError(400, `Chi nhánh id=${branchId} không tồn tại`);
    if (!branch.isActive) throw new ApiError(400, `Chi nhánh "${branch.branchCode}" đang ngừng hoạt động`);
    return branch;
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
      throw new ApiError(400, 'name, email, password, roleId là bắt buộc');
    }

    const nameTrimmed = String(name).trim();
    const emailTrimmed = String(email).trim();
    const lastNameTrimmed = lastName !== undefined && lastName !== null ? String(lastName).trim() : '';
    if (!isValidUsername(nameTrimmed)) {
      throw new ApiError(400, 'Tên đăng nhập 3–50 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang');
    }
    if (!lastNameTrimmed) {
      throw new ApiError(400, 'Tên là bắt buộc');
    }
    if (lastNameTrimmed.length > NAME_MAX_LENGTH) {
      throw new ApiError(400, `Tên tối đa ${NAME_MAX_LENGTH} ký tự`);
    }

    const phoneTrimmed = phone !== undefined && phone !== null
      ? phoneDigitsOnly(phone)
      : '';
    if (!phoneTrimmed) {
      throw new ApiError(400, 'Số điện thoại là bắt buộc');
    }
    if (!isValidPhone(phoneTrimmed)) {
      throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (không tính dấu gạch)');
    }

    let parsedBranchId = null;
    let isScopeAllBranches = false;
    if (scopeAllBranches === true) {
      isScopeAllBranches = true;
    } else if (branchId !== null && branchId !== undefined && branchId !== '') {
      parsedBranchId = Number(branchId);
      if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
        throw new ApiError(400, 'branchId không hợp lệ');
      }
    } else {
      throw new ApiError(400, 'branchId là bắt buộc (hoặc chọn "Tất cả chi nhánh")');
    }

    if (emailTrimmed.length > EMAIL_MAX_LENGTH || !isValidEmail(emailTrimmed)) {
      throw new ApiError(400, EMAIL_HINT);
    }

    if (!isValidPassword(password)) {
      throw new ApiError(400, `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số`);
    }

    const existedEmail = await this.adminUserRepository.findByEmail(emailTrimmed);
    if (existedEmail) {
      throw new ApiError(409, 'Email đã tồn tại');
    }

    const existedPhone = await this.adminUserRepository.findByPhone(phoneTrimmed);
    if (existedPhone) {
      throw new ApiError(409, 'Số điện thoại đã tồn tại');
    }

    await this.assertActiveRole(Number(roleId));
    if (!isScopeAllBranches) {
      await this.assertActiveBranch(parsedBranchId);
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    try {
      const user = await this.adminUserRepository.create({
        name: nameTrimmed,
        email: emailTrimmed,
        passwordHash,
        firstName: (firstName && String(firstName).trim()) || nameTrimmed,
        lastName: lastNameTrimmed,
        phone: phoneTrimmed,
        branchId: parsedBranchId,
        roleId: Number(roleId),
        scopeAllBranches: isScopeAllBranches,
      });
      return user;
    } catch (err) {
      throw new ApiError(400, err.message || 'Tạo user thất bại');
    }
  }

  async getDashboardStats(filters = {}) {
    return this.adminUserRepository.getDashboardStats(filters);
  }

  async updateUser(payload) {
    const {
      userId,
      firstName,
      lastName,
      email,
      phone,
      status,
      roleId,
      branchId,
      scopeAllBranches,
      actorUserId,
    } = payload;

    if (!userId) {
      throw new ApiError(400, 'userId là bắt buộc');
    }

    const existing = await this.adminUserRepository.findById(Number(userId));
    if (!existing) {
      throw new ApiError(404, 'Người dùng không tồn tại');
    }

    const VALID_STATUSES = ['active', 'inactive'];
    if (status !== undefined && status !== null && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'status không hợp lệ: active, inactive');
    }

    // Không cho tự khóa / tự inactive chính mình
    if (
      status === 'inactive'
      && actorUserId !== undefined
      && actorUserId !== null
      && Number(actorUserId) === Number(userId)
    ) {
      throw new ApiError(400, 'Không thể tự khóa tài khoản của chính mình');
    }

    if (email !== undefined && email !== null) {
      const emailTrimmed = String(email).trim();
      if (!emailTrimmed) {
        throw new ApiError(400, 'Email không được rỗng');
      }
      if (emailTrimmed.length > EMAIL_MAX_LENGTH || !isValidEmail(emailTrimmed)) {
        throw new ApiError(400, EMAIL_HINT);
      }
      const emailOwner = await this.adminUserRepository.findByEmail(emailTrimmed);
      if (emailOwner && Number(emailOwner.id) !== Number(userId)) {
        throw new ApiError(409, 'Email đã tồn tại');
      }
      payload.email = emailTrimmed;
    }

    if (phone !== undefined && phone !== null) {
      const phoneTrimmed = phoneDigitsOnly(phone);
      if (!phoneTrimmed) {
        throw new ApiError(400, 'Số điện thoại là bắt buộc');
      }
      if (!isValidPhone(phoneTrimmed)) {
        throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (không tính dấu gạch)');
      }
      const phoneOwner = await this.adminUserRepository.findByPhone(phoneTrimmed);
      if (phoneOwner && Number(phoneOwner.id) !== Number(userId)) {
        throw new ApiError(409, 'Số điện thoại đã tồn tại');
      }
      payload.phone = phoneTrimmed;
    }

    if (lastName !== undefined && lastName !== null && !String(lastName).trim()) {
      throw new ApiError(400, 'Tên không được rỗng');
    }
    if (lastName !== undefined && lastName !== null) {
      payload.lastName = String(lastName).trim();
      if (payload.lastName.length > NAME_MAX_LENGTH) {
        throw new ApiError(400, `Tên tối đa ${NAME_MAX_LENGTH} ký tự`);
      }
    }
    if (firstName !== undefined && firstName !== null) {
      payload.firstName = String(firstName).trim();
      if (payload.firstName.length > NAME_MAX_LENGTH) {
        throw new ApiError(400, `Họ tối đa ${NAME_MAX_LENGTH} ký tự`);
      }
    }

    let parsedBranchId;
    let shouldUpdateBranchId = false;
    let isScopeAllBranches = false;
    if (scopeAllBranches === true) {
      isScopeAllBranches = true;
      parsedBranchId = null;
      shouldUpdateBranchId = true;
    } else if (branchId === null) {
      parsedBranchId = null;
      shouldUpdateBranchId = true;
    } else if (branchId !== undefined && branchId !== '') {
      parsedBranchId = Number(branchId);
      if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
        throw new ApiError(400, 'branchId không hợp lệ');
      }
      shouldUpdateBranchId = true;
    }

    let parsedRoleId;
    if (roleId !== undefined && roleId !== null && roleId !== '') {
      parsedRoleId = Number(roleId);
      if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
        throw new ApiError(400, 'roleId không hợp lệ');
      }
      await this.assertActiveRole(parsedRoleId);
    }

    if (shouldUpdateBranchId && !isScopeAllBranches && parsedBranchId) {
      await this.assertActiveBranch(parsedBranchId);
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
      throw new ApiError(400, err.message || 'Cập nhật người dùng thất bại');
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
      throw new ApiError(400, 'Mật khẩu mới là bắt buộc khi chọn chế độ nhập tay');
    }
    const password = String(rawPassword).trim();
    if (!isValidPassword(password)) {
      throw new ApiError(400, `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số`);
    }
    return password;
  }

  /**
   * Admin reset mat khau cho user
   * - Co 2 che do:
   *   + newPassword duoc cung cap: dung MK do (admin nhap tay)
   *   + newPassword khong cung cap: generate MK ngau nhien 12 ky tu (hoa+thuong+so+dac biet)
   * - Hash bcrypt, luu DB (khong bat buoc doi MK lan sau)
   * - Tra ve MK plain text 1 lan duy nhat (controller se gui cho FE)
   */
  async resetPassword({ userId, newPassword } = {}) {
    if (!userId) {
      throw new ApiError(400, 'userId la bat buoc');
    }

    // Kiem tra user ton tai
    const existing = await this.adminUserRepository.findById(Number(userId));
    if (!existing) {
      throw new ApiError(404, 'Nguoi dung khong ton tai');
    }

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
      passwordHash
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
      message: isManual
        ? 'Mat khau moi da duoc dat theo gia tri admin nhap.'
        : 'Mat khau da duoc dat lai thanh cong.',
    };
  }

  _sendPasswordResetNotification(userId) {
    try {
      const NotificationService = require('./NotificationService');
      const ns = new NotificationService();
      // .catch() bat buoc - notify() la async, khong await o day (fire-and-
      // forget) nen reject se thanh unhandled rejection lam crash ca process.
      ns.notify('PASSWORD_CHANGED', { userId, resetByAdmin: true }).catch((err) => {
        console.error('[AdminUserService] Failed to send password reset notification:', err.message);
      });
    } catch (err) {
      console.error('[AdminUserService] Failed to send password reset notification:', err.message);
    }
  }
}

module.exports = AdminUserService;
