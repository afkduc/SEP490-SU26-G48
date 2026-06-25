class UserResponseDto {
  constructor(user) {
    if (!user) return;
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }

  static fromEntity(user) {
    return new UserResponseDto(user);
  }
}

module.exports = UserResponseDto;
