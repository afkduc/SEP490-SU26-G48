const ApiError = require('../../utils/ApiError');
const BranchRepositoryImpl = require('../../infrastructure/repositories/BranchRepositoryImpl');

class BranchService {
  constructor() {
    this.branchRepository = new BranchRepositoryImpl();
  }

  async list() {
    return this.branchRepository.findAll();
  }

  async getById(id) {
    const branch = await this.branchRepository.findById(Number(id));
    if (!branch) {
      throw new ApiError(404, 'Chi nhanh khong ton tai');
    }
    return branch;
  }

  async getManagerCandidates() {
    const [assigned, unassigned] = await Promise.all([
      this.branchRepository.findManagerCandidates(),
      this.branchRepository.findUnassignedManagers(),
    ]);
    return { assigned, unassigned };
  }

  async getStats(branchId) {
    return this.branchRepository.getBranchStats(Number(branchId));
  }

  async create(payload) {
    const { branchCode, branchName, address, phone, email, managerId } = payload;

    if (!branchCode || !branchName) {
      throw new ApiError(400, 'branchCode va branchName la bat buoc');
    }

    if (branchCode.trim().length > 20) {
      throw new ApiError(400, 'branchCode toi da 20 ky tu');
    }

    const existed = await this.branchRepository.findByCode(branchCode.trim());
    if (existed) {
      throw new ApiError(409, 'Ma chi nhanh da ton tai');
    }

    const id = await this.branchRepository.create({
      branchCode: branchCode.trim(),
      branchName: branchName.trim(),
      address,
      phone,
      email,
      managerId: managerId ? Number(managerId) : null,
    });

    return this.branchRepository.findById(id);
  }

  async update(id, payload) {
    const existing = await this.branchRepository.findById(Number(id));
    if (!existing) {
      throw new ApiError(404, 'Chi nhanh khong ton tai');
    }

    const { branchName, address, phone, email, managerId } = payload;

    if (branchName !== undefined && !branchName.trim()) {
      throw new ApiError(400, 'branchName khong duoc rong');
    }

    return this.branchRepository.update(id, {
      branchName: branchName ? branchName.trim() : undefined,
      address: address !== undefined ? (address ? address.trim() : null) : undefined,
      phone: phone !== undefined ? (phone ? phone.trim() : null) : undefined,
      email: email !== undefined ? (email ? email.trim() : null) : undefined,
      managerId: managerId !== undefined ? (managerId ? Number(managerId) : null) : undefined,
    });
  }

  async deactivate(id) {
    const existing = await this.branchRepository.findById(Number(id));
    if (!existing) {
      throw new ApiError(404, 'Chi nhanh khong ton tai');
    }
    return this.branchRepository.setActive(id, false);
  }

  async reactivate(id) {
    const existing = await this.branchRepository.findById(Number(id));
    if (!existing) {
      throw new ApiError(404, 'Chi nhanh khong ton tai');
    }
    return this.branchRepository.setActive(id, true);
  }
}

module.exports = BranchService;
