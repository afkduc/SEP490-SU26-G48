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

  // Danh sach co van dich vu cua CHINH chi nhanh nguoi dang dang nhap -
  // branchId lay tu token, khong nhan tu query, nen khong xem sang chi nhanh
  // khac duoc.
  getBranchAdvisors = async (req, res, next) => {
    try {
      const items = await this.repairSettlementService.getBranchAdvisors(req.user.branchId);
      return success(res, items, 'Branch advisors retrieved');
    } catch (err) {
      next(err);
    }
  };

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
      const { item, changes } = await this.repairSettlementService.update(req.params.id, req.body);
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
        changes,
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
      // Lưu request_body tiếng Việt để admin đọc log không thấy Kind/settlement
      const prevBody = req.body;
      req.body = { loaiBanIn: kind };
      try {
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
      } finally {
        req.body = prevBody;
      }
      return success(res, { ok: true }, 'Print logged');
    } catch (err) {
      next(err);
    }
  };

  // Co van ghi nhan quyet dinh cua khach cho 1 dau muc "Khong dat".
  decideNgTask = async (req, res, next) => {
    try {
      const item = await this.repairSettlementService.decideNgTask(req.params.id, req.params.taskId, {
        decision: req.body.decision,
        note: req.body.note,
        userId: req.user.userId,
        branchId: req.user.branchId,
      });
      const dongY = req.body.decision === 'accepted';
      const tenDauMuc = (item?.tasks || []).find((t) => String(t.id) === String(req.params.taskId))?.taskName;
      await auditCrud.lifecycle(req, {
        tableName: 'repair_settlements',
        entityCode: item?.code || `ID-${req.params.id}`,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Phiếu quyết toán',
        step: dongY ? 'ng_accepted' : 'ng_declined',
        stepLabel: dongY ? 'Khách đồng ý thay' : 'Khách từ chối thay',
        action: 'UPDATE',
        description: `${dongY ? 'Khách đồng ý thay' : 'Khách từ chối thay'}`
          + `${tenDauMuc ? ` — ${tenDauMuc}` : ''} (phiếu ${item?.code || req.params.id})`
          + (req.body.note ? ` — ${req.body.note}` : ''),
      });
      return success(res, item, 'NG decision saved');
    } catch (err) {
      next(err);
    }
  };

  lock = async (req, res, next) => {
    try {
      const result = await this.repairSettlementService.acquireLock(req.params.id, req);
      return success(res, result, 'Đã mở phiếu');
    } catch (err) {
      next(err);
    }
  };

  unlock = async (req, res, next) => {
    try {
      const result = await this.repairSettlementService.releaseLock(req.params.id, req);
      return success(res, result, 'Đã đóng phiếu');
    } catch (err) {
      next(err);
    }
  };

  getActivityLog = async (req, res, next) => {
    try {
      const steps = await this.repairSettlementService.getActivityLog(req.params.id);
      return success(res, { steps }, 'Activity log retrieved');
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
