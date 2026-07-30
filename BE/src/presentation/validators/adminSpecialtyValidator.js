const ApiError = require('../../utils/ApiError');
const {
  SPECIALTY_CODE_MAX,
  SPECIALTY_NAME_MAX,
} = require('../../utils/fieldValidation');

function validateCreateSpecialty(req, res, next) {
  try {
    const { specialtyCode, specialtyName } = req.body || {};
    if (!specialtyCode || !String(specialtyCode).trim()) {
      throw new ApiError(400, 'specialtyCode là bắt buộc');
    }
    if (String(specialtyCode).trim().length > SPECIALTY_CODE_MAX) {
      throw new ApiError(400, `specialtyCode tối đa ${SPECIALTY_CODE_MAX} ký tự`);
    }
    if (!specialtyName || !String(specialtyName).trim()) {
      throw new ApiError(400, 'specialtyName là bắt buộc');
    }
    if (String(specialtyName).trim().length > SPECIALTY_NAME_MAX) {
      throw new ApiError(400, `specialtyName tối đa ${SPECIALTY_NAME_MAX} ký tự`);
    }
    next();
  } catch (err) {
    next(err);
  }
}

function validateUpdateSpecialty(req, res, next) {
  try {
    const { specialtyName } = req.body || {};
    if (!specialtyName || !String(specialtyName).trim()) {
      throw new ApiError(400, 'specialtyName không được rỗng');
    }
    if (String(specialtyName).trim().length > SPECIALTY_NAME_MAX) {
      throw new ApiError(400, `specialtyName tối đa ${SPECIALTY_NAME_MAX} ký tự`);
    }
    next();
  } catch (err) {
    next(err);
  }
}

function validateSetUserSpecialties(req, res, next) {
  try {
    const { specialtyIds } = req.body || {};
    if (!Array.isArray(specialtyIds)) {
      throw new ApiError(400, 'specialtyIds phải là mảng');
    }
    for (const id of specialtyIds) {
      const n = Number(id);
      if (!Number.isInteger(n) || n <= 0) {
        throw new ApiError(400, 'Mỗi specialtyId phải là số nguyên dương');
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  validateCreateSpecialty,
  validateUpdateSpecialty,
  validateSetUserSpecialties,
};
