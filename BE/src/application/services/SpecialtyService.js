const SpecialtyRepository = require('../../infrastructure/repositories/SpecialtyRepository');
const ApiError = require('../../utils/ApiError');

class SpecialtyService {
  constructor() {
    this.specialtyRepository = new SpecialtyRepository();
  }

  async list() {
    return this.specialtyRepository.findAll();
  }

  async getById(id) {
    const specialty = await this.specialtyRepository.findById(Number(id));
    if (!specialty) throw new ApiError(404, 'Chuyen mon khong ton tai');
    return specialty;
  }

  async create(payload) {
    const { specialtyCode, specialtyName } = payload;

    if (!specialtyCode || !specialtyCode.trim()) {
      throw new ApiError(400, 'specialtyCode la bat buoc');
    }
    if (!specialtyName || !specialtyName.trim()) {
      throw new ApiError(400, 'specialtyName la bat buoc');
    }

    const existed = await this.specialtyRepository.findByCode(specialtyCode.trim());
    if (existed) {
      throw new ApiError(409, 'Ma chuyen mon da ton tai');
    }

    const id = await this.specialtyRepository.create({
      specialtyCode: specialtyCode.trim().toUpperCase(),
      specialtyName: specialtyName.trim(),
    });

    return this.specialtyRepository.findById(id);
  }

  async update(id, payload) {
    const existing = await this.specialtyRepository.findById(Number(id));
    if (!existing) throw new ApiError(404, 'Chuyen mon khong ton tai');

    const { specialtyName } = payload;
    if (!specialtyName || !specialtyName.trim()) {
      throw new ApiError(400, 'specialtyName khong duoc rong');
    }

    return this.specialtyRepository.update(id, { specialtyName: specialtyName.trim() });
  }

  async delete(id) {
    const existing = await this.specialtyRepository.findById(Number(id));
    if (!existing) throw new ApiError(404, 'Chuyen mon khong ton tai');

    const result = await this.specialtyRepository.delete(id);
    if (!result.success) {
      throw new ApiError(409, 'Khong the xoa chuyen mon dang duoc gan cho nguoi dung');
    }
    return { deleted: true, id: Number(id) };
  }

  async toggleStatus(id) {
    const existing = await this.specialtyRepository.findById(Number(id));
    if (!existing) throw new ApiError(404, 'Chuyen mon khong ton tai');
    return this.specialtyRepository.toggleStatus(id);
  }

  async getUserSpecialties(userId) {
    return this.specialtyRepository.findByUserId(Number(userId));
  }

  async setUserSpecialties(userId, specialtyIds) {
    await this.specialtyRepository.setUserSpecialties(Number(userId), specialtyIds);
    return this.specialtyRepository.findByUserId(Number(userId));
  }
}

module.exports = SpecialtyService;
