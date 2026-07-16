const { success } = require('../../utils/response');

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
      return success(res, item, 'Reminder marked as confirmed');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = MaintenanceReminderController;
