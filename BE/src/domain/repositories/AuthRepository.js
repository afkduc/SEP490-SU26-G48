class AuthRepository {
  async findUserByEmail(email) {
    throw new Error('Not implemented');
  }
  async findUserRoles(userId) {
    throw new Error('Not implemented');
  }
}

module.exports = AuthRepository;
