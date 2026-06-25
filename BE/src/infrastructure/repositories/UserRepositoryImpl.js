const UserRepository = require('../../domain/repositories/UserRepository');
const UserModel = require('../database/models/UserModel');
const User = require('../../domain/entities/User');

class UserRepositoryImpl extends UserRepository {
  async findAll() {
    const records = await UserModel.find().lean();
    return records.map((r) => User.fromPersistence(r));
  }

  async findById(id) {
    const record = await UserModel.findById(id).lean();
    return User.fromPersistence(record);
  }

  async create(userData) {
    const record = await UserModel.create(userData);
    return User.fromPersistence(record.toObject());
  }

  async update(id, userData) {
    const record = await UserModel.findByIdAndUpdate(id, userData, { new: true, runValidators: true }).lean();
    return User.fromPersistence(record);
  }

  async delete(id) {
    const record = await UserModel.findByIdAndDelete(id).lean();
    return User.fromPersistence(record);
  }
}

module.exports = UserRepositoryImpl;
