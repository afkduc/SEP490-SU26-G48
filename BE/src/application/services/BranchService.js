const ApiError = require('../../utils/ApiError');
const BranchRepositoryImpl = require('../../infrastructure/repositories/BranchRepositoryImpl');
const { auditCrud } = require('../../utils/auditHelper');
const {
  EMAIL_HINT,
  isValidEmail,
  isValidPhone,
  getBranchNameError,
  phoneDigitsOnly,
} = require('../../utils/fieldValidation');

function normalizeOptionalPhone(phone) {
  if (phone === undefined || phone === null || !String(phone).trim()) return null;
  return phoneDigitsOnly(phone) || null;
}

function validateOptionalContact({ phone, email }) {
  if (phone !== undefined && phone !== null && String(phone).trim()) {
    if (!isValidPhone(phone)) {
      throw new ApiError(400, 'Số điện thoại phải bắt đầu bằng 0, 10–11 chữ số');
    }
  }
  if (email !== undefined && email !== null && String(email).trim()) {
    if (!isValidEmail(email)) {
      throw new ApiError(400, EMAIL_HINT);
    }
  }
}

class BranchService {
  constructor({ branchRepository } = {}) {
    this.branchRepository = branchRepository || new BranchRepositoryImpl();
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
    if (branchCode.trim().length > 20) {
      throw new ApiError(400, 'branchCode toi da 20 ky tu');
    }

    const branchNameTrimmed = String(branchName || '').trim().replace(/\s+/g, ' ');
    const branchNameErr = getBranchNameError(branchNameTrimmed, { required: true });
    if (branchNameErr) throw new ApiError(400, branchNameErr);

    validateOptionalContact({ phone, email });

    const existed = await this.branchRepository.findByCode(branchCode.trim());
    if (existed) {
      throw new ApiError(409, 'Ma chi nhanh da ton tai');
    }

    const id = await this.branchRepository.create({
      branchCode: branchCode.trim(),
      branchName: branchNameTrimmed,
      address: address ? String(address).trim().slice(0, 255) : null,
      phone: normalizeOptionalPhone(phone),
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

    let branchNameTrimmed;
    if (branchName !== undefined) {
      branchNameTrimmed = String(branchName).trim().replace(/\s+/g, ' ');
      const branchNameErr = getBranchNameError(branchNameTrimmed, { required: true });
      if (branchNameErr) throw new ApiError(400, branchNameErr);
    }

    validateOptionalContact({ phone, email });

    const updated = await this.branchRepository.update(id, {
      branchName: branchNameTrimmed,
      address: address !== undefined
        ? (address ? String(address).trim().slice(0, 255) : null)
        : undefined,
      phone: phone !== undefined ? normalizeOptionalPhone(phone) : undefined,
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
