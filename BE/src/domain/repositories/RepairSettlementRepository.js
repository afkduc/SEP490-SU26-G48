class RepairSettlementRepository {
  async findAll({ branchId, status, search, page = 1, limit = 20 } = {}) {
    throw new Error('Method findAll() must be implemented');
  }

  async count({ branchId, status, search } = {}) {
    throw new Error('Method count() must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  async create(data, { branchId, advisorId }) {
    throw new Error('Method create() must be implemented');
  }

  async update(id, data) {
    throw new Error('Method update() must be implemented');
  }

  async updateStatus(id, status, { issuedBy } = {}) {
    throw new Error('Method updateStatus() must be implemented');
  }
}

module.exports = RepairSettlementRepository;
