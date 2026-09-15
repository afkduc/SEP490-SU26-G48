const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const { auditCrud } = require('../../utils/auditHelper');

// Do dai khop cot trong DB (vehicle_models) de bao loi de hieu thay vi SQL
// nem "String or binary data would be truncated".
const MODEL_LINE_MAX = 100;
const GENERATION_MAX = 30;
const TRIM_MAX = 100;
const SEGMENT_MAX = 50;
const DISPLAY_MAX = 300;

function clean(v) {
  return v === undefined || v === null ? '' : String(v).trim().replace(/\s+/g, ' ');
}

// Tra ve { data, errors } - data da chuan hoa, errors rong = hop le.
// Khong nhan year_from/year_to: chi la ghi chu, khong logic nao dung, xem
// ensureVehicleModelYearOptional.js.
function validateVehicleModel(body = {}, allowedSegments = []) {
  const errors = [];

  const modelLine = clean(body.modelLine);
  if (!modelLine) errors.push('Dòng xe không được để trống');
  else if (modelLine.length > MODEL_LINE_MAX) errors.push(`Dòng xe tối đa ${MODEL_LINE_MAX} ký tự`);

  const generationCode = clean(body.generationCode);
  if (!generationCode) errors.push('Mã đời xe không được để trống');
  else if (generationCode.length > GENERATION_MAX) errors.push(`Mã đời xe tối đa ${GENERATION_MAX} ký tự`);

  const trimName = clean(body.trimName);
  if (!trimName) errors.push('Phiên bản không được để trống');
  else if (trimName.length > TRIM_MAX) errors.push(`Phiên bản tối đa ${TRIM_MAX} ký tự`);

  const segment = clean(body.segment);
  if (!segment) errors.push('Vui lòng chọn phân khúc');
  else if (segment.length > SEGMENT_MAX) errors.push(`Phân khúc tối đa ${SEGMENT_MAX} ký tự`);
  else if (allowedSegments.length && !allowedSegments.includes(segment)) {
    errors.push(`Phân khúc phải là một trong: ${allowedSegments.join(', ')}`);
  }

  const displayName = clean(body.displayName);
  if (!displayName) errors.push('Tên hiển thị không được để trống');
  else if (displayName.length > DISPLAY_MAX) errors.push(`Tên hiển thị tối đa ${DISPLAY_MAX} ký tự`);

  return {
    errors,
    data: { modelLine, generationCode, trimName, segment, displayName },
  };
}

class VehicleModelController {
  constructor({ vehicleModelRepository }) {
    this.vehicleModelRepository = vehicleModelRepository;
  }

  list = async (req, res, next) => {
    try {
      const items = await this.vehicleModelRepository.list();
      return success(res, items, 'Vehicle models retrieved');
    } catch (err) {
      next(err);
    }
  };

  listSegments = async (req, res, next) => {
    try {
      const items = await this.vehicleModelRepository.listSegments();
      return success(res, items, 'Vehicle segments retrieved');
    } catch (err) {
      next(err);
    }
  };

  // POST /vehicles/models - them dong xe moi vao danh muc (Manager).
  create = async (req, res, next) => {
    try {
      const segments = await this.vehicleModelRepository.listSegments();
      const { errors, data } = validateVehicleModel(req.body, segments);
      if (errors.length) throw new ApiError(400, errors.join('. '));

      const dup = await this.vehicleModelRepository.findByKey(data.modelLine, data.generationCode, data.trimName);
      if (dup) {
        throw new ApiError(409, `Dòng xe "${dup.displayName}" đã có trong danh mục (cùng dòng ${data.modelLine} / đời ${data.generationCode} / bản ${data.trimName})`);
      }

      const created = await this.vehicleModelRepository.create(data);
      await auditCrud.create(req, {
        tableName: 'vehicle_models',
        entityCode: created.displayName,
        recordId: created.id,
        entityName: 'Dòng xe',
        data,
      });
      return success(res, created, 'Vehicle model created');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = VehicleModelController;
module.exports.validateVehicleModel = validateVehicleModel;
