const ApiError = require('../../utils/ApiError');
const UserResponseDto = require('../dto/UserResponseDto');

class UserService {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async getAllUsers() {
    const users = await this.userRepository.findAll();
    return users.map((u) => UserResponseDto.fromEntity(u));
  }

  async getUserById(id) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new ApiError(404, 'User not found');
    return UserResponseDto.fromEntity(user);
  }

  async createUser(payload) {
    if (!payload?.name || !payload?.email) {
      throw new ApiError(400, 'Name and email are required');
    }
    const user = await this.userRepository.create(payload);
    return UserResponseDto.fromEntity(user);
  }

  async updateUser(id, payload) {
    const user = await this.userRepository.update(id, payload);
    if (!user) throw new ApiError(404, 'User not found');
    return UserResponseDto.fromEntity(user);
  }

  async deleteUser(id) {
    const user = await this.userRepository.delete(id);
    if (!user) throw new ApiError(404, 'User not found');
    return UserResponseDto.fromEntity(user);
  }
}

module.exports = UserService;
