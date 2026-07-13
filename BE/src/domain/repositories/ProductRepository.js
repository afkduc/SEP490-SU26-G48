const Product = require('../entities/Product');

class ProductRepository {
  async findAll({ branchId, status, search, category, page = 1, limit = 20 } = {}) {
    throw new Error('Method findAll() must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  async findByCode(code, branchId) {
    throw new Error('Method findByCode() must be implemented');
  }

  async create(data) {
    throw new Error('Method create() must be implemented');
  }

  async update(id, data) {
    throw new Error('Method update() must be implemented');
  }

  async delete(id) {
    throw new Error('Method delete() must be implemented');
  }

  async count({ branchId, status, search, category } = {}) {
    throw new Error('Method count() must be implemented');
  }
}

module.exports = ProductRepository;
