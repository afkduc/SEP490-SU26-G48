const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const NotificationService = require('../../application/services/NotificationService');

// Tick dau muc/Hoan thanh (updateStatus/updateTaskStatus) van nam ben
// PublicBayBoardController.js - viec do dien ra tai chinh khoang xe (khong
// dang nhap, xem Landing/app/khoang). Controller nay chi con lai phan to
// truong lam TU TAI KHOAN CUA CHINH HO (dang nhap binh thuong, khong dung
// chung nua): xem phieu cho, nhan viec + gan khoang + gan tho cung luc.
class RepairOrderController {
  constructor({ repairOrderService }) {
    this.repairOrderService = repairOrderService;
    this.notificationService = new NotificationService();
  }

  // Public - khong auth (xem publicRoutes.js), khong duoc dung req.user o day.
  lookupPublicProgress = async (req, res, next) => {
    try {
      const result = await this.repairOrderService.getPublicProgressByCode(req.params.code);
      return success(res, result, 'Repair progress retrieved');
    } catch (err) {
      next(err);
    }
  };

  // To truong nhan 1 phieu quyet toan tu bang tin chung ca chi nhanh, gan
  // luon cho 1 khoang cua chinh minh (bayId chon tu GET /vehicle-bays/mine).
  claim = async (req, res, next) => {
    try {
      const item = await this.repairOrderService.claim(req.body.serviceOrderId, {
        branchId: req.user.branchId,
        teamLeaderId: req.user.userId,
        bayId: req.body.bayId,
        bayNumber: req.body.bayNumber,
      });
      await auditCrud.create(req, {
        tableName: 'repair_orders',
        entityCode: item?.code || null,
        recordId: item?.id || null,
        entityName: 'Phiếu sửa chữa',
        data: req.body,
      });
      await this.notificationService.notifyAdmins('REPAIR_ORDER_CREATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.code || `ID-${item?.id}`,
        targetCode: item?.code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairOrderController] notifyAdmins:', e.message));
      return success(res, item, 'Repair order claimed', 201);
    } catch (err) {
      next(err);
    }
  };

  // Goi y tho de gan ngay sau khi nhan viec (cung man voi buoc chon khoang).
  searchTechnicians = async (req, res, next) => {
    try {
      const items = await this.repairOrderService.searchTechnicians(req.user.userId, req.user.branchId, req.query.q);
      return success(res, items, 'Technicians retrieved');
    } catch (err) {
      next(err);
    }
  };

  setTechnicians = async (req, res, next) => {
    try {
      const item = await this.repairOrderService.setTechnicians(req.params.id, req.body.technicianIds, {
        branchId: req.user.branchId,
        teamLeaderId: req.user.userId,
      });
      await auditCrud.update(req, {
        tableName: 'repair_orders',
        entityCode: item?.code || `ID-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Phiếu sửa chữa',
        newData: { technicianIds: req.body.technicianIds },
        description: `Phân công thợ cho lệnh sửa chữa ${item?.code || req.params.id}`,
      });
      return success(res, item, 'Technicians assigned');
    } catch (err) {
      next(err);
    }
  };

  // Toan bo lenh sua chua cua to truong dang dang nhap (inprogress + hoan
  // thanh) - dung ca cho "Khoang xe cua toi" (loc inprogress, ghep voi bay
  // qua bayId de xem tien do dau muc) lan "Lich su" (loc completed). Cung
  // du lieu voi PublicBayBoardController.getHistory, chi khac cho danh tinh
  // den tu req.user thay vi resolve qua bayId.
  getMine = async (req, res, next) => {
    try {
      const items = await this.repairOrderService.getAll({
        branchId: req.user.branchId,
        teamLeaderId: req.user.userId,
      });
      return success(res, items, 'Repair orders retrieved');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = RepairOrderController;
