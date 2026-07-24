const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

class VehicleOwnershipController {
  constructor({ vehicleOwnershipService }) {
    this.vehicleOwnershipService = vehicleOwnershipService;
    this.notificationService = new NotificationService();
  }

  getHistory = async (req, res, next) => {
    try {
      const items = await this.vehicleOwnershipService.getHistory(req.params.id);
      return success(res, items, 'Vehicle owner history retrieved');
    } catch (err) {
      next(err);
    }
  };

  transfer = async (req, res, next) => {
    try {
      const { newCustomerId, newCustomer, transferDate, notes } = req.body;
      const items = await this.vehicleOwnershipService.transfer(req.params.id, {
        newCustomerId,
        newCustomer,
        transferDate,
        notes,
      });
      await auditCrud.update(req, {
        tableName: 'vehicles',
        entityCode: items?.vehicle?.vehicle_code || `ID-${req.params.id}`,
        recordId: items?.vehicle?.id || Number(req.params.id) || null,
        entityName: 'Phương tiện',
        newData: { newCustomerId, transferDate, notes },
        description: `Chuyển quyền sở hữu xe cho khách hàng ${newCustomer?.name || newCustomerId}`,
      });
      await this.notificationService.notifyAdmins('VEHICLE_OWNERSHIP_TRANSFERRED', {
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: items?.vehicle?.license_plate || items?.vehicle?.vehicle_code || `ID-${req.params.id}`,
        targetCode: items?.vehicle?.vehicle_code || '',
        userId: items?.vehicle?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[VehicleOwnershipController] notifyAdmins:', e.message));
      return success(res, items, 'Vehicle ownership transferred');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = VehicleOwnershipController;
