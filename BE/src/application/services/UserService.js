const ApiError = require('../../utils/ApiError');
const UserResponseDto = require('../dto/UserResponseDto');

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
    const existed = await this.userRepository.findByEmail(payload.email);
    if (existed) throw new ApiError(409, 'Email da ton tai');

    const user = await this.userRepository.create({
      name: payload.name,
      email: payload.email,
      user_password: payload.password,
      fullName: payload.fullName,
      phone: payload.phone,
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

  async updateUser(id, payload) {
    const existed = await this.userRepository.findById(id);
    if (!existed) throw new ApiError(404, 'User not found');

    const user = await this.userRepository.update(id, {
      name: payload.name ?? existed.name,
      email: payload.email ?? existed.email,
      fullName: payload.fullName,
      phone: payload.phone,
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

  async deleteUser(id, currentUserId) {
    if (Number(id) === Number(currentUserId)) {
      throw new ApiError(400, 'Khong the xoa chinh minh');
    }
    const user = await this.userRepository.delete(id);
    if (!user) throw new ApiError(404, 'User not found');
    return { id: user.id, name: user.name, email: user.email };
  }
}

module.exports = UserService;
