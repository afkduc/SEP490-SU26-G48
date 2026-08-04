const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');

function bayCode(bayOrId) {
  if (bayOrId && typeof bayOrId === 'object') {
    if (bayOrId.bayNumber != null) return `BAY-${bayOrId.bayNumber}`;
    if (bayOrId.id != null) return `BAY-ID-${bayOrId.id}`;
  }
  return bayOrId != null ? `BAY-ID-${bayOrId}` : null;
}

class VehicleBayController {
  constructor({ vehicleBayService }) {
    this.vehicleBayService = vehicleBayService;
  }

  listMine = async (req, res, next) => {
    try {
      const items = await this.vehicleBayService.listMine(req.user.userId);
      return success(res, items, 'Vehicle bays retrieved');
    } catch (err) {
      next(err);
    }
  };

  listByBranch = async (req, res, next) => {
    try {
      const items = await this.vehicleBayService.listByBranch(req.user.branchId);
      return success(res, items, 'Branch vehicle bays retrieved');
    } catch (err) {
      next(err);
    }
  };

  occupy = async (req, res, next) => {
    try {
      const bay = await this.vehicleBayService.occupy(req.params.id, {
        teamLeaderId: req.user.userId,
        userId: req.user.userId,
        deviceId: req.body.deviceId,
        branchId: req.user.branchId,
      });
      await auditCrud.update(req, {
        tableName: 'vehicle_bays',
        entityCode: bayCode(bay) || bayCode(req.params.id),
        recordId: bay?.id || Number(req.params.id) || null,
        entityName: 'Khoang xe',
        newData: {
          occupiedByDeviceId: bay?.occupiedByDeviceId || req.body.deviceId,
          occupiedByUserId: bay?.occupiedByUserId || req.user.userId,
        },
        description: `Chiếm khoang ${bayCode(bay) || req.params.id}`,
      });
      return success(res, bay, 'Bay occupied');
    } catch (err) {
      next(err);
    }
  };

  release = async (req, res, next) => {
    try {
      await this.vehicleBayService.release(req.params.id, {
        deviceId: req.body.deviceId,
        branchId: req.user.branchId,
      });
      await auditCrud.update(req, {
        tableName: 'vehicle_bays',
        entityCode: bayCode(req.params.id),
        recordId: Number(req.params.id) || null,
        entityName: 'Khoang xe',
        newData: { released: true, deviceId: req.body.deviceId },
        description: `Nhả khoang BAY-ID-${req.params.id}`,
      });
      return success(res, { released: true }, 'Bay released');
    } catch (err) {
      next(err);
    }
  };

  // heartbeat goi lien tuc — KHONG ghi audit de tranh ngap bang audit_logs.
  heartbeat = async (req, res, next) => {
    try {
      await this.vehicleBayService.heartbeat(req.params.id, req.body.deviceId);
      return success(res, { ok: true }, 'Heartbeat received');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = VehicleBayController;
