const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');

// Goi y "Tên xe" (doi xe) luc CVDV go tay cho xe MOI trong form tao phieu
// quyet toan - xem RepairSettlementPage.jsx. Chi la du lieu tham khao de go
// nhanh + tranh trung ten do loi chinh ta, khong rang buoc vehicles.vehicle_
// model_text (van la text tu do luu tren tung xe).
class VehicleModelController {
  constructor({ vehicleModelRepository }) {
    this.vehicleModelRepository = vehicleModelRepository;
  }

  search = async (req, res, next) => {
    try {
      const { brandId, q } = req.query;
      const items = await this.vehicleModelRepository.search({ brandId, q, limit: 20 });
      return success(res, items, 'Vehicle models retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const modelName = String(req.body?.modelName || '').trim();
      if (!modelName) throw new ApiError(400, 'Phải nhập tên xe');
      const item = await this.vehicleModelRepository.create({ brandId: req.body?.brandId, modelName });
      return success(res, item, 'Vehicle model created');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = VehicleModelController;
