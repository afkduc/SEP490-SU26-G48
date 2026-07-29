const SpecialtyRepository = require('../../infrastructure/repositories/SpecialtyRepository');
const ApiError = require('../../utils/ApiError');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('./NotificationService');

class SpecialtyService {
  constructor() {
    this.specialtyRepository = new SpecialtyRepository();
    this.notificationService = new NotificationService();
  }

  async list() {
    return this.specialtyRepository.findAll();
  }

  async getById(id) {
    const specialty = await this.specialtyRepository.findById(Number(id));
    if (!specialty) throw new ApiError(404, 'Chuyen mon khong ton tai');
    return specialty;
  }

  async create(payload, actorInfo = {}) {
    const { specialtyCode, specialtyName } = payload;

    if (!specialtyCode || !specialtyCode.trim()) {
      throw new ApiError(400, 'specialtyCode la bat buoc');
    }
    if (!specialtyName || !specialtyName.trim()) {
      throw new ApiError(400, 'specialtyName la bat buoc');
    }
    if (specialtyCode.trim().length > 30) {
      throw new ApiError(400, 'specialtyCode toi da 30 ky tu');
    }
    if (specialtyName.trim().length > 100) {
      throw new ApiError(400, 'specialtyName toi da 100 ky tu');
    }

    const existed = await this.specialtyRepository.findByCode(specialtyCode.trim());
    if (existed) {
      throw new ApiError(409, 'Ma chuyen mon da ton tai');
    }

    const id = await this.specialtyRepository.create({
      specialtyCode: specialtyCode.trim().toUpperCase(),
      specialtyName: specialtyName.trim(),
    });

    const specialty = await this.specialtyRepository.findById(id);

    // Gửi notification cho admin
    if (actorInfo.userId) {
      this.notificationService.notifyAdmins('SPECIALTY_CREATED', {
        userId: actorInfo.userId,
        actorName: actorInfo.name || actorInfo.userName || 'Admin',
        targetName: specialty.specialtyName,
      }, { excludeUserId: actorInfo.userId }).catch(err => {
        console.warn('[SpecialtyService] notifyAdmins failed:', err.message);
      });
    }

    return specialty;
  }

  async update(id, payload, actorInfo = {}) {
    const existing = await this.specialtyRepository.findById(Number(id));
    if (!existing) throw new ApiError(404, 'Chuyen mon khong ton tai');

    const { specialtyName } = payload;
    if (!specialtyName || !specialtyName.trim()) {
      throw new ApiError(400, 'specialtyName khong duoc rong');
    }

    const result = await this.specialtyRepository.update(id, { specialtyName: specialtyName.trim() });
    const updated = await this.specialtyRepository.findById(id);

    // Gửi notification cho admin
    if (actorInfo.userId) {
      this.notificationService.notifyAdmins('SPECIALTY_UPDATED', {
        userId: actorInfo.userId,
        actorName: actorInfo.name || actorInfo.userName || 'Admin',
        targetName: updated.specialtyName,
      }, { excludeUserId: actorInfo.userId }).catch(err => {
        console.warn('[SpecialtyService] notifyAdmins failed:', err.message);
      });
    }

    return updated;
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
    const uid = Number(userId);
    if (!Number.isInteger(uid) || uid <= 0) {
      throw new ApiError(400, 'userId khong hop le');
    }
    if (!Array.isArray(specialtyIds)) {
      throw new ApiError(400, 'specialtyIds phai la mang');
    }
    const ids = specialtyIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length !== specialtyIds.length) {
      throw new ApiError(400, 'specialtyIds chua ID khong hop le');
    }
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length > 0) {
      const all = await this.specialtyRepository.findAll();
      const valid = new Set(all.map((s) => Number(s.id)));
      const invalid = uniqueIds.filter((id) => !valid.has(id));
      if (invalid.length > 0) {
        throw new ApiError(400, `Chuyen mon khong ton tai: ${invalid.join(', ')}`);
      }
    }
    await this.specialtyRepository.setUserSpecialties(uid, uniqueIds);
    return this.specialtyRepository.findByUserId(uid);
  }
}

module.exports = SpecialtyService;
