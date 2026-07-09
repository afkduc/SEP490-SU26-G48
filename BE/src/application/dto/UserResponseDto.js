class UserResponseDto {
  constructor(user) {
    if (!user) return;
    this.id = user.id;
    this.name = user.name;
    this.fullName = user.fullName ?? null;
    this.email = user.email;
    this.phone = user.phone ?? null;
    this.branchId = user.branchId ?? null;
    this.status = user.status ?? null;
    this.lastLoginAt = user.lastLoginAt ?? null;
    this.createdBy = user.createdBy ?? null;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.roles = user.roles || [];
  }

  static fromEntity(user) {
    return new UserResponseDto(user);
  }
}

module.exports = UserResponseDto;
