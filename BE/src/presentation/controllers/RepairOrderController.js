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
      // Chưa ghi audit ở bước chọn khoang — đợi tổ trưởng xác nhận phân công thợ
      // (setTechnicians) rồi mới ghi 1 dòng tổng hợp để tránh spam nhật ký.
      const item = await this.repairOrderService.claim(req.body.repairOrderId, {
        branchId: req.user.branchId,
        teamLeaderId: req.user.userId,
        bayId: req.body.bayId,
        bayNumber: req.body.bayNumber,
      });
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
      const before = await this.repairOrderService.getById(req.params.id);
      const hadTechnicians = Array.isArray(before?.technicians) && before.technicians.length > 0;
      const item = await this.repairOrderService.setTechnicians(req.params.id, req.body.technicianIds, {
        branchId: req.user.branchId,
        teamLeaderId: req.user.userId,
      });
      const entityCode = item?.code || `ID-${req.params.id}`;
      const recordId = item?.id || Number(req.params.id) || null;
      const { repairOrderSnapshot } = require('../../utils/auditSnapshots');
      const techNames = (item?.technicians || [])
        .map((t) => t.fullName || t.name || t.technicianName)
        .filter(Boolean)
        .join(', ');
      const stepLabel = hadTechnicians ? 'Cập nhật phân công thợ' : 'Nhận việc & phân công thợ';
      await auditCrud.lifecycle(req, {
        tableName: 'repair_orders',
        entityCode,
        recordId,
        entityName: 'Lệnh sửa chữa',
        step: hadTechnicians ? 'reassigned' : 'assigned',
        stepLabel,
        action: hadTechnicians ? 'UPDATE' : 'CREATE',
        description: `${stepLabel} cho lệnh ${entityCode}`
          + (item?.bayNumber != null ? ` — Khoang ${item.bayNumber}` : '')
          + (techNames ? ` — Thợ: ${techNames}` : ''),
        snapshot: repairOrderSnapshot(item),
      });
      if (!hadTechnicians) {
        await this.notificationService.notifyAdmins('REPAIR_ORDER_CREATED', {
          auditLogId: req._lastAuditLogId,
          actorName: req.user?.name || req.user?.email || 'Admin',
          targetName: entityCode,
          targetCode: item?.code || '',
          userId: item?.id,
        }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairOrderController] notifyAdmins:', e.message));
      } else {
        await this.notificationService.notifyAdmins('REPAIR_ORDER_UPDATED', {
          auditLogId: req._lastAuditLogId,
          actorName: req.user?.name || req.user?.email || 'Admin',
          targetName: entityCode,
          targetCode: item?.code || '',
          userId: item?.id,
        }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairOrderController] notifyAdmins:', e.message));
      }
      return success(res, item, 'Technicians assigned');
    } catch (err) {
      next(err);
    }
  };

  // To truong go tich 1 dau muc da hoan thanh = yeu cau lam lai dau muc do.
  // Lenh dang cho xac nhan se tu quay ve "dang lam" cho khoang lam tiep -
  // xem RepairOrderService.reopenTask.
  reopenTask = async (req, res, next) => {
    try {
      const before = await this.repairOrderService.getById(req.params.id);
      const taskName = (before?.tasks || []).find((t) => String(t.id) === String(req.params.taskId))?.taskName;
      const item = await this.repairOrderService.reopenTask(req.params.id, req.params.taskId, {
        branchId: req.user.branchId,
        teamLeaderId: req.user.userId,
      });
      const entityCode = item?.code || `ID-${req.params.id}`;
      const { repairOrderSnapshot } = require('../../utils/auditSnapshots');
      await auditCrud.lifecycle(req, {
        tableName: 'repair_orders',
        entityCode,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Lệnh sửa chữa',
        step: 'task_reopened',
        stepLabel: 'Yêu cầu làm lại đầu mục',
        action: 'UPDATE',
        description: `Tổ trưởng yêu cầu làm lại đầu mục${taskName ? ` "${taskName}"` : ''} của lệnh ${entityCode}`
          + (item?.bayNumber != null ? ` — Khoang ${item.bayNumber}` : ''),
        snapshot: repairOrderSnapshot(item, {
          status: item?.status,
          reopenedTaskId: Number(req.params.taskId) || null,
          reopenedTaskName: taskName || null,
          bayNumber: item?.bayNumber,
        }),
      });
      return success(res, item, 'Task reopened');
    } catch (err) {
      next(err);
    }
  };

  // To truong chuyen 1 dau muc "Khong dat" len co van dich vu de goi bao gia
  // cho khach - xem RepairOrderService.forwardNgTask.
  //
  // GHI AUDIT: day la moc bat dau chuoi "gara khuyen cao khach thay X". Neu
  // sau nay khach khieu nai (xe hong ma bao khong ai noi gi), day la bang
  // chung to truong da chuyen canh bao di luc may gio, cho ai.
  forwardNgTask = async (req, res, next) => {
    try {
      const before = await this.repairOrderService.getById(req.params.id);
      const task = (before?.tasks || []).find((t) => String(t.id) === String(req.params.taskId));
      const item = await this.repairOrderService.forwardNgTask(req.params.id, req.params.taskId, {
        branchId: req.user.branchId,
        teamLeaderId: req.user.userId,
      });
      const entityCode = item?.code || `ID-${req.params.id}`;
      const { repairOrderSnapshot } = require('../../utils/auditSnapshots');
      await auditCrud.lifecycle(req, {
        tableName: 'repair_orders',
        entityCode,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Lệnh sửa chữa',
        step: 'ng_forwarded',
        stepLabel: 'Báo cố vấn hạng mục không đạt',
        action: 'UPDATE',
        description: `Tổ trưởng báo cố vấn dịch vụ hạng mục không đạt${task?.taskName ? ` "${task.taskName}"` : ''}`
          + ` của lệnh ${entityCode}`
          + (task?.checkNote ? ` — ${task.checkNote}` : ''),
        snapshot: repairOrderSnapshot(item, {
          status: item?.status,
          ngTaskId: Number(req.params.taskId) || null,
          ngTaskName: task?.taskName || null,
          ngNote: task?.checkNote || null,
        }),
      });
      return success(res, item, 'NG task forwarded to advisor');
    } catch (err) {
      next(err);
    }
  };

  // To truong tu khac phuc 1 dau muc "Khong dat" ma khong qua co van - xem
  // RepairOrderService.resolveNgTask.
  //
  // GHI AUDIT: dau muc dang tu "Không đạt" chuyen thanh "Đạt", day la doi ket
  // qua kiem tra tren ho so xe. Phai luu ai doi, luc nao, va da lam gi.
  resolveNgTask = async (req, res, next) => {
    try {
      const before = await this.repairOrderService.getById(req.params.id);
      const task = (before?.tasks || []).find((t) => String(t.id) === String(req.params.taskId));
      const item = await this.repairOrderService.resolveNgTask(req.params.id, req.params.taskId, {
        note: req.body.note,
        branchId: req.user.branchId,
        teamLeaderId: req.user.userId,
      });
      const entityCode = item?.code || `ID-${req.params.id}`;
      const { repairOrderSnapshot } = require('../../utils/auditSnapshots');
      await auditCrud.lifecycle(req, {
        tableName: 'repair_orders',
        entityCode,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Lệnh sửa chữa',
        step: 'ng_resolved',
        stepLabel: 'Xử lý tại xưởng hạng mục không đạt',
        action: 'UPDATE',
        description: `Tổ trưởng xử lý tại xưởng hạng mục không đạt${task?.taskName ? ` "${task.taskName}"` : ''}`
          + ` của lệnh ${entityCode}`
          + (task?.checkNote ? ` — thợ ghi: ${task.checkNote}` : '')
          + ` — đã xử lý: ${String(req.body.note || '').trim()}`,
        snapshot: repairOrderSnapshot(item, {
          status: item?.status,
          ngTaskId: Number(req.params.taskId) || null,
          ngTaskName: task?.taskName || null,
          ngReason: task?.checkNote || null,
          ngResolution: String(req.body.note || '').trim() || null,
        }),
      });
      return success(res, item, 'NG task resolved in-house');
    } catch (err) {
      next(err);
    }
  };

  // To truong xac nhan lenh da xong that su, sau khi khoang xe bao xong viec.
  // Day moi la buoc lam phieu quyet toan chuyen "Chờ thanh toán" ben man CVDV
  // va giai phong khoang - xem RepairOrderService.confirmCompleted.
  confirmComplete = async (req, res, next) => {
    try {
      const item = await this.repairOrderService.confirmCompleted(req.params.id, {
        branchId: req.user.branchId,
        teamLeaderId: req.user.userId,
      });
      const entityCode = item?.code || `ID-${req.params.id}`;
      const doneTasks = (item?.tasks || []).filter((t) => t.isDone);
      const { repairOrderSnapshot } = require('../../utils/auditSnapshots');
      await auditCrud.lifecycle(req, {
        tableName: 'repair_orders',
        entityCode,
        recordId: item?.id || Number(req.params.id) || null,
        entityName: 'Lệnh sửa chữa',
        step: 'completed',
        stepLabel: 'Hoàn thành sửa chữa',
        action: 'UPDATE',
        description: `Tổ trưởng xác nhận hoàn thành lệnh ${entityCode}`
          + (item?.bayNumber != null ? ` — Khoang ${item.bayNumber}` : '')
          + (doneTasks.length ? ` (${doneTasks.length} đầu mục)` : ''),
        snapshot: repairOrderSnapshot(item, {
          status: item?.status,
          completedTaskCount: doneTasks.length,
          taskNames: doneTasks.map((t) => t.taskName).filter(Boolean),
          bayNumber: item?.bayNumber,
        }),
      });
      await this.notificationService.notifyAdmins('REPAIR_ORDER_UPDATED', {
        auditLogId: req._lastAuditLogId,
        actorName: req.user?.name || req.user?.email || 'Tổ trưởng',
        targetName: entityCode,
        targetCode: item?.code || '',
        userId: item?.id,
      }, { excludeUserId: req.user?.userId }).catch((e) => console.warn('[RepairOrderController] notifyAdmins:', e.message));
      return success(res, item, 'Repair order completed');
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
