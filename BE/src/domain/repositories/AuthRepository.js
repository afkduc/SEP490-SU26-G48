class AuthRepository {
  async findUserByEmail(email) {
    throw new Error('Not implemented');
  }
  async findUserRoles(userId) {
    throw new Error('Not implemented');
  }
  async incrementTokenVersion(userId) {
    throw new Error('Not implemented');
  }
  async getTokenVersion(userId) {
    throw new Error('Not implemented');
  }
}

module.exports = AuthRepository;
