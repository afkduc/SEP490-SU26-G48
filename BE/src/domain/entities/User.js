class User {
  constructor({
    id,
    name,
    email,
    fullName,
    phone,
    branchId,
    status,
    lastLoginAt,
    createdBy,
    createdAt,
    updatedAt,
    roles,
  } = {}) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.fullName = fullName;
    this.phone = phone;
    this.branchId = branchId;
    this.status = status;
    this.lastLoginAt = lastLoginAt;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.roles = roles || [];
  }

  static fromPersistence(record) {
    if (!record) return null;
    return new User(record);
  }
}

module.exports = User;
