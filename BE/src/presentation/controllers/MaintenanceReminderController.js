const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');

function reminderLabel(item) {
  const plate = item?.vehicle?.licensePlate || item?.vehicle?.license_plate || null;
  if (plate) return `NHAC-${plate}`;
  return item?.id != null ? `NHAC-${item.id}` : null;
}

class MaintenanceReminderController {
  constructor({ maintenanceReminderService }) {
    this.maintenanceReminderService = maintenanceReminderService;
  }

  getAll = async (req, res, next) => {
    try {
      const { status, search } = req.query;
      const items = await this.maintenanceReminderService.getAll({
        branchId: req.user.branchId,
        status,
        search,
      });
      return success(res, items, 'Maintenance reminders retrieved');
    } catch (err) {
      next(err);
    }
  };

  markSent = async (req, res, next) => {
    try {
      const item = await this.maintenanceReminderService.markSent(req.params.id, {
        branchId: req.user.branchId,
        notes: req.body.notes,
      });
      await auditCrud.update(req, {
        tableName: 'maintenance_reminders',
        entityCode: reminderLabel(item) || `NHAC-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Nhắc nhở bảo dưỡng',
        newData: { isSent: true, notes: req.body.notes },
        description: `Đánh dấu đã gửi nhắc nhở ${reminderLabel(item) || req.params.id}`,
      });
      return success(res, item, 'Reminder marked as sent');
    } catch (err) {
      next(err);
    }
  };

  markConfirmed = async (req, res, next) => {
    try {
      const item = await this.maintenanceReminderService.markConfirmed(req.params.id, {
        branchId: req.user.branchId,
        confirmedDate: req.body.confirmedDate,
        notes: req.body.notes,
      });
      await auditCrud.update(req, {
        tableName: 'maintenance_reminders',
        entityCode: reminderLabel(item) || `NHAC-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Nhắc nhở bảo dưỡng',
        newData: {
          isConfirmed: true,
          confirmedDate: req.body.confirmedDate,
          notes: req.body.notes,
        },
        description: `Xác nhận nhắc nhở bảo dưỡng ${reminderLabel(item) || req.params.id}`,
      });
      return success(res, item, 'Reminder marked as confirmed');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = MaintenanceReminderController;
