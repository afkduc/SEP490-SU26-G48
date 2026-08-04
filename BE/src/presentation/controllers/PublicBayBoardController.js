const { success } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

// Man khoang xe cong khai (khong dang nhap) - Landing "/khoang/<chi nhanh>/
// <so khoang>". Chi con lai phan "lam viec tai khoang": xem viec dang lam,
// tick dau muc, bam Hoan thanh. Phan "nhan viec" (chon phieu + gan khoang +
// gan tho) va "Lich su" da chuyen ve tai khoan cua chinh to truong (dang
// nhap binh thuong, xem RepairOrderController.js) - khoang xe chi con NHAN
// viec da duoc gan san, khong tu claim nua.
//
// Danh tinh (branchId/teamLeaderId) LUON resolve tu bayId trong URL (tra
// vehicle_bays), khong dung req.user. auditCrud/notifyAdmins van giu lai du
// khong co req.user - auditHelper tu xu ly (ghi userName='system'),
// actorName cho notifyAdmins dung ten to truong cua khoang thay vi req.user.
class PublicBayBoardController {
  constructor({ vehicleBayRepository, repairOrderService }) {
    this.vehicleBayRepository = vehicleBayRepository;
    this.repairOrderService = repairOrderService;
    this.notificationService = new NotificationService();
  }

  async _resolveBay(bayId) {
    const bay = bayId ? await this.vehicleBayRepository.findById(bayId) : null;
    if (!bay) throw new ApiError(404, 'Không tìm thấy khoang xe này');
    return bay;
  }

  listBays = async (req, res, next) => {
    try {
      const branchId = Number(req.query.branchId);
      if (!branchId) throw new ApiError(400, 'Thiếu chi nhánh');
      const items = await this.vehicleBayRepository.findByBranch(branchId);
      return success(res, items, 'Vehicle bays retrieved');
    } catch (err) {
      next(err);
    }
  };

  getActiveOrder = async (req, res, next) => {
    try {
      const bay = await this._resolveBay(req.params.bayId);
      if (!bay.activeRepairOrderId) return success(res, null, 'No active order');
      const item = await this.repairOrderService.getById(bay.activeRepairOrderId);
      return success(res, item, 'Active order retrieved');
    } catch (err) {
      next(err);
    }
  };

  updateTaskStatus = async (req, res, next) => {
    try {
      const bay = await this._resolveBay(req.body.bayId);
      const item = await this.repairOrderService.updateTaskStatus(
        req.params.id,
        req.params.taskId,
        Boolean(req.body.isDone),
        { userId: bay.teamLeaderId, branchId: bay.branchId }
      );
      return success(res, item, 'Task status updated');
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req, res, next) => {
    try {
      const bay = await this._resolveBay(req.body.bayId);
      const item = await this.repairOrderService.updateStatus(req.params.id, req.body.status, {
        branchId: bay.branchId,
      });
      await auditCrud.update(req, {
        tableName: 'repair_orders',
        entityCode: item?.code || `ID-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Phiếu sửa chữa',
        newData: { status: req.body.status },
      });
      await this.notificationService.notifyAdmins('REPAIR_ORDER_UPDATED', {
        actorName: bay.teamLeaderName ? `Tổ trưởng ${bay.teamLeaderName} (Khoang ${bay.bayNumber})` : `Khoang ${bay.bayNumber}`,
        targetName: item?.code || `ID-${req.params.id}`,
        targetCode: item?.code || '',
        userId: item?.id,
      }).catch((e) => console.warn('[PublicBayBoardController] notifyAdmins:', e.message));
      return success(res, item, 'Repair order status updated');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = PublicBayBoardController;
