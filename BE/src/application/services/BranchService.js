const ApiError = require('../../utils/ApiError');
const BranchRepositoryImpl = require('../../infrastructure/repositories/BranchRepositoryImpl');
const { auditCrud } = require('../../utils/auditHelper');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0[0-9]{9,10}$/;

function validateOptionalContact({ phone, email }) {
  if (phone !== undefined && phone !== null && String(phone).trim()) {
    if (!PHONE_REGEX.test(String(phone).trim())) {
      throw new ApiError(400, 'So dien thoai phai bat dau bang 0, 10-11 chu so');
    }
  }
  if (email !== undefined && email !== null && String(email).trim()) {
    if (!EMAIL_REGEX.test(String(email).trim())) {
      throw new ApiError(400, 'Email khong dung dinh dang');
    }
  }
}

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

  async create(payload, req = {}) {
    const { branchCode, branchName, address, phone, email, managerId } = payload;

    if (!branchCode || !String(branchCode).trim()) {
      throw new ApiError(400, 'branchCode la bat buoc');
    }
    if (!branchName || !String(branchName).trim()) {
      throw new ApiError(400, 'branchName la bat buoc');
    }

    if (branchCode.trim().length > 20) {
      throw new ApiError(400, 'branchCode toi da 20 ky tu');
    }

    validateOptionalContact({ phone, email });

    const existed = await this.branchRepository.findByCode(branchCode.trim());
    if (existed) {
      throw new ApiError(409, 'Ma chi nhanh da ton tai');
    }

    const id = await this.branchRepository.create({
      branchCode: branchCode.trim(),
      branchName: branchName.trim(),
      address: address ? String(address).trim() : null,
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      managerId: managerId ? Number(managerId) : null,
    });

    const branch = await this.branchRepository.findById(id);
    await auditCrud.create(req, {
      tableName: 'branches',
      entityCode: branch?.branchCode || null,
      recordId: branch?.id || id,
      entityName: 'Chi nhánh',
      data: payload,
    });
    return branch;
  }

  async update(id, payload, req = {}) {
    const existing = await this.branchRepository.findById(Number(id));
    if (!existing) {
      throw new ApiError(404, 'Chi nhanh khong ton tai');
    }

    const { branchName, address, phone, email, managerId } = payload;

    if (branchName !== undefined && !String(branchName).trim()) {
      throw new ApiError(400, 'branchName khong duoc rong');
    }

    validateOptionalContact({ phone, email });

    const updated = await this.branchRepository.update(id, {
      branchName: branchName ? branchName.trim() : undefined,
      address: address !== undefined ? (address ? String(address).trim() : null) : undefined,
      phone: phone !== undefined ? (phone ? String(phone).trim() : null) : undefined,
      email: email !== undefined ? (email ? String(email).trim() : null) : undefined,
      managerId: managerId !== undefined ? (managerId ? Number(managerId) : null) : undefined,
    });

    await auditCrud.update(req, {
      tableName: 'branches',
      entityCode: existing.branchCode || null,
      recordId: existing.id || Number(id),
      entityName: 'Chi nhánh',
      oldData: existing,
      newData: payload,
    });
    return updated;
  }

  async deactivate(id, req = {}) {
    const existing = await this.branchRepository.findById(Number(id));
    if (!existing) {
      throw new ApiError(404, 'Chi nhanh khong ton tai');
    }
    const updated = await this.branchRepository.setActive(id, false);
    await auditCrud.update(req, {
      tableName: 'branches',
      entityCode: existing.branchCode || null,
      recordId: existing.id || Number(id),
      entityName: 'Chi nhánh',
      oldData: { ...existing, isActive: true },
      newData: { isActive: false },
      description: `Vô hiệu hóa chi nhánh ${existing.branchCode || existing.branchName}`,
    });
    return updated;
  }

  async reactivate(id, req = {}) {
    const existing = await this.branchRepository.findById(Number(id));
    if (!existing) {
      throw new ApiError(404, 'Chi nhanh khong ton tai');
    }
    const updated = await this.branchRepository.setActive(id, true);
    await auditCrud.update(req, {
      tableName: 'branches',
      entityCode: existing.branchCode || null,
      recordId: existing.id || Number(id),
      entityName: 'Chi nhánh',
      oldData: { ...existing, isActive: false },
      newData: { isActive: true },
      description: `Kích hoạt lại chi nhánh ${existing.branchCode || existing.branchName}`,
    });
    return updated;
  }
}

module.exports = BranchService;
