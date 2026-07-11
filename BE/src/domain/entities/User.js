class User {
  constructor({
    id,
    name,
    email,
    firstName,
    lastName,
    phone,
    branchId,
    status,
    createdAt,
    roles,
  } = {}) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.firstName = firstName;
    this.lastName = lastName;
    this.phone = phone;
    this.branchId = branchId;
    this.status = status;
    this.createdAt = createdAt;
    this.roles = roles || [];
  }

  static fromPersistence(record) {
    if (!record) return null;
    return new User(record);
  }
}

module.exports = User;
