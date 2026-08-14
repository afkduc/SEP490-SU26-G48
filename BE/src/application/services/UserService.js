const ApiError = require('../../utils/ApiError');
const UserResponseDto = require('../dto/UserResponseDto');
const {
  isValidEmail,
  isValidPhone,
  phoneDigitsOnly,
  EMAIL_HINT,
} = require('../../utils/fieldValidation');

const PHONE_FORMAT_HINT =
  'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (không tính dấu gạch)';

class UserService {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async getAllUsers() {
    const users = await this.userRepository.findAll();
    return Promise.all(
      users.map(async (u) => {
        const roles = await this.userRepository.findUserRoles(u.id);
        return UserResponseDto.fromEntity({ ...u, roles });
      })
    );
  }

  async getUserById(id) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new ApiError(404, 'User not found');
    const roles = await this.userRepository.findUserRoles(user.id);
    return UserResponseDto.fromEntity({ ...user, roles });
  }

  async createUser(payload, createdBy = null) {
    if (!payload?.name || !payload?.email || !payload?.password) {
      throw new ApiError(400, 'Name, email va password la bat buoc');
    }
    if (!isValidEmail(payload.email)) {
      throw new ApiError(400, EMAIL_HINT);
    }

    const existed = await this.userRepository.findByEmail(payload.email);
    if (existed) throw new ApiError(409, 'Email đã tồn tại');

    let phone = null;
    if (payload.phone != null && String(payload.phone).trim() !== '') {
      phone = phoneDigitsOnly(payload.phone);
      if (!isValidPhone(phone)) {
        throw new ApiError(400, PHONE_FORMAT_HINT);
      }
      if (typeof this.userRepository.findByPhone === 'function') {
        const phoneOwner = await this.userRepository.findByPhone(phone);
        if (phoneOwner) throw new ApiError(409, 'Số điện thoại đã tồn tại');
      }
    }

    const user = await this.userRepository.create({
      name: payload.name,
      email: String(payload.email).trim(),
      user_password: payload.password,
      fullName: payload.fullName,
      phone,
      branchId: payload.branchId,
      status: payload.status,
      createdBy,
    });

    if (Array.isArray(payload.roles) && payload.roles.length > 0) {
      for (const role of payload.roles) {
        await this.userRepository.attachRole(user.id, role);
      }
    }

    const roles = await this.userRepository.findUserRoles(user.id);
    return UserResponseDto.fromEntity({ ...user, roles });
  }

  async updateUser(id, payload, currentUserId = null) {
    const existed = await this.userRepository.findById(id);
    if (!existed) throw new ApiError(404, 'User not found');

    if (payload.email) {
      if (!isValidEmail(payload.email)) {
        throw new ApiError(400, EMAIL_HINT);
      }
      const emailOwner = await this.userRepository.findByEmail(payload.email);
      if (emailOwner && emailOwner.id !== Number(id)) {
        throw new ApiError(409, 'Email đã tồn tại');
      }
    }

    let phone = payload.phone;
    if (payload.phone != null && String(payload.phone).trim() !== '') {
      phone = phoneDigitsOnly(payload.phone);
      if (!isValidPhone(phone)) {
        throw new ApiError(400, PHONE_FORMAT_HINT);
      }
      if (typeof this.userRepository.findByPhone === 'function') {
        const phoneOwner = await this.userRepository.findByPhone(phone);
        if (phoneOwner && Number(phoneOwner.id) !== Number(id)) {
          throw new ApiError(409, 'Số điện thoại đã tồn tại');
        }
      }
    }

    const user = await this.userRepository.update(id, {
      name: payload.name ?? existed.name,
      email: payload.email ?? existed.email,
      fullName: payload.fullName,
      phone,
      branchId: payload.branchId,
      status: payload.status,
    });

    if (Array.isArray(payload.roles)) {
      await this.userRepository.clearUserRoles(user.id);
      for (const role of payload.roles) {
        await this.userRepository.attachRole(user.id, role);
      }
    }

    const roles = await this.userRepository.findUserRoles(user.id);
    return UserResponseDto.fromEntity({ ...user, roles });
  }

  async deleteUser(id, currentUserId = null) {
    if (Number(id) === Number(currentUserId)) {
      throw new ApiError(400, 'Khong the xoa chinh minh');
    }
    const user = await this.userRepository.delete(id);
    if (!user) throw new ApiError(404, 'User not found');
    return { id: user.id, name: user.name, email: user.email };
  }
}

module.exports = UserService;
