const { success } = require('../../utils/response');
const { auditCrud } = require('../../utils/auditHelper');
const { settlementSnapshot } = require('../../utils/auditSnapshots');
const NotificationService = require('../../application/services/NotificationService');
const ApiError = require('../../utils/ApiError');

class RepairSettlementController {
  constructor({ repairSettlementService }) {
    this.repairSettlementService = repairSettlementService;
    this.notificationService = new NotificationService();
  }

  getAll = async (req, res, next) => {
    try {
      const { status, search, customerId, vehicleId, fromDate, toDate, page = 1, limit = 20, scope } = req.query;
      const isServiceAdvisor = req.user.roles?.includes('service_advisor');
      const result = await this.repairSettlementService.getAll({
        branchId: req.user.branchId,
        status,
        search,
        customerId,
        vehicleId,
        fromDate,
        toDate,
        // Chi loc theo advisorId khi dang xem danh sach chung cua chi nhanh
        // (khong truyen customerId/vehicleId) - man lich su khach hang/xe van
        // phai thay du, khong bi che theo advisor dang dang nhap. scope=branch
        // (man "Lenh sua chua") cung khong loc - bang dieu phoi chung ca chi
        // nhanh, moi co van deu phai thay het de gan to truong cho nhau duoc.
        advisorId: isServiceAdvisor && !customerId && !vehicleId && scope !== 'branch' ? req.user.userId : undefined,
        page: Number(page),
        limit: Number(limit),
      });
      return success(res, result, 'Repair settlements retrieved');
    } catch (err) {
      next(err);
    }
  };

  // Public - khong dang nhap (xem publicRoutes.js), khong duoc dung req.user o day.
  lookupPublicHistory = async (req, res, next) => {
    try {
      const result = await this.repairSettlementService.getPublicHistoryByPlateOrFrame(req.params.identifier);
      return success(res, result, 'Vehicle history retrieved');
    } catch (err) {
      next(err);
    }
  };

  // Public (khong dang nhap) - man hinh bao ve tai cong, xem publicRoutes.js.
  getGatePending = async (req, res, next) => {
    try {
      const branchId = Number(req.query.branchId);
      if (!branchId) throw new ApiError(400, 'Thiếu chi nhánh');
      const result = await this.repairSettlementService.getGatePending(branchId);
      return success(res, result, 'Gate pending list retrieved');
    } catch (err) {
      next(err);
    }
  };

  confirmGateExit = async (req, res, next) => {
    try {
      const branchId = Number(req.body.branchId);
      if (!branchId) throw new ApiError(400, 'Thiếu chi nhánh');
      const result = await this.repairSettlementService.confirmGateExit(req.params.id, branchId);
      return success(res, result, 'Gate exit confirmed');
    } catch (err) {
      next(err);
    }
  };

  checkDuplicate = async (req, res, next) => {
    try {
      const { customerId, vehicleId, excludeId } = req.query;
      const result = await this.repairSettlementService.checkActiveDuplicate(customerId, vehicleId, excludeId);
      return success(res, result, 'Checked active duplicate');
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.getById(req.params.id);
      return success(res, item, 'Repair settlement retrieved');
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.create(req.body, {
        branchId: req.user.branchId,
        advisorId: req.user.userId,
      });
      const signed = Boolean(req.body?.signatureData || item?.signerName);
      await auditCrud.lifecycle(req, {
        tableName: 'repair_settlements',
        entityCode: item?.code || null,
        recordId: item?.id || null,
        entityName: 'Phiếu quyết toán',
        step: signed ? 'created_signed' : 'created',
        stepLabel: signed ? 'Tạo phiếu & khách hàng ký' : 'Tạo phiếu',
        action: 'CREATE',
        description: `Phiếu quyết toán ${item?.code || item?.id}: ${signed ? 'đã tạo và khách hàng ký' : 'đã tạo'}`,
        snapshot: settlementSnapshot(item, { hasSignature: signed }),
      });
      await this.notificationService.notifyAdmins('SETTLEMENT_CREATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.code || `ID-${item?.id}`,
        targetCode: item?.code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairSettlementController] notifyAdmins:', e.message));
      return success(res, item, 'Repair settlement created', 201);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.update(req.params.id, req.body);
      await auditCrud.lifecycle(req, {
        tableName: 'repair_settlements',
        entityCode: item?.code || `ID-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Phiếu quyết toán',
        step: 'updated',
        stepLabel: 'Cập nhật nội dung phiếu',
        action: 'UPDATE',
        description: `Phiếu quyết toán ${item?.code || req.params.id}: cập nhật nội dung`,
        snapshot: settlementSnapshot(item),
      });
      await this.notificationService.notifyAdmins('SETTLEMENT_UPDATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.code || `ID-${req.params.id}`,
        targetCode: item?.code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairSettlementController] notifyAdmins:', e.message));
      return success(res, item, 'Repair settlement updated');
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.updateStatus(req.params.id, req.body.status, {
        issuedBy: req.user.userId,
        cancelReason: req.body.reason,
      });
      const status = String(req.body.status || '').toLowerCase();
      const stepMap = {
        waiting_payment: { step: 'waiting_payment', label: 'Chờ thanh toán' },
        invoiced: { step: 'paid', label: 'Thanh toán / xuất hóa đơn' },
        cancelled: { step: 'cancelled', label: 'Hủy phiếu' },
        inprogress: { step: 'inprogress', label: 'Đang sửa chữa' },
        waiting_repair: { step: 'waiting_repair', label: 'Chờ sửa chữa' },
      };
      const mapped = stepMap[status] || { step: 'status', label: `Trạng thái: ${req.body.status}` };
      await auditCrud.lifecycle(req, {
        tableName: 'repair_settlements',
        entityCode: item?.code || `ID-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Phiếu quyết toán',
        step: mapped.step,
        stepLabel: mapped.label,
        action: 'UPDATE',
        description: `Phiếu quyết toán ${item?.code || req.params.id}: ${mapped.label}`
          + (req.body.reason ? ` — ${req.body.reason}` : ''),
        snapshot: settlementSnapshot(item, { status: req.body.status, reason: req.body.reason || null }),
      });
      await this.notificationService.notifyAdmins('SETTLEMENT_UPDATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Admin',
        targetName: item?.code || `ID-${req.params.id}`,
        targetCode: item?.code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairSettlementController] notifyAdmins:', e.message));
      return success(res, item, 'Repair settlement status updated');
    } catch (err) {
      next(err);
    }
  };

  // Cap nhat cung 1 dong lifecycle khi in (khong tao log rieng)
  logPrint = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.getById(req.params.id);
      if (!item) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
      const isWorklist = String(req.body?.kind || 'settlement').toLowerCase() === 'worklist';
      const kind = isWorklist ? 'danh sách công việc' : 'phiếu quyết toán';
      await auditCrud.lifecycle(req, {
        tableName: 'repair_settlements',
        entityName: 'Phiếu quyết toán',
        entityCode: item.code || `ID-${req.params.id}`,
        recordId: item.id || Number(req.params.id) || null,
        step: isWorklist ? 'print_worklist' : 'print_settlement',
        stepLabel: `In ${kind}`,
        action: 'EXPORT',
        description: `Phiếu quyết toán ${item.code || req.params.id}: in ${kind}`,
        snapshot: settlementSnapshot(item, { lastPrintKind: kind }),
      });
      return success(res, { ok: true }, 'Print logged');
    } catch (err) {
      next(err);
    }
  };

  createPaymentLink = async (req, res, next) => {
    try {
      const result = await this.repairSettlementService.createPayosPaymentLink(req.params.id, req);
      return success(res, result, 'PayOS payment link created');
    } catch (err) {
      next(err);
    }
  };
}

module.exports = RepairSettlementController;
