const ApiError = require('../../utils/ApiError');
const RepairOrderResponseDto = require('../dto/RepairOrderDto');
const PublicRepairProgressDto = require('../dto/PublicRepairProgressDto');
const { emitRepairOrderEvent } = require('../events/RepairOrderEvents');

// 'cancelled' khong con la trang thai co the goi truc tiep qua endpoint nay -
// huy gio la mot chieu tu Phieu quyet toan (xem RepairSettlementService
// .updateStatus), tranh 2 duong huy khac hanh vi nhau (truoc day duong nay
// tra phieu ve "waiting_repair" de nhan lai, gay nham lan voi huy hoan toan).
const UPDATABLE_STATUS_VALUES = ['completed'];

// Khach huy giua chung (co van bam huy tren Phieu quyet toan) trong khi to
// truong dang thao tac tren lenh sua chua (tick dau muc/bam Hoan thanh) -
// bao dung ly do CVDV da nhap thay vi thong bao chung chung "da ket thuc",
// kem code rieng de FE nhan biet va hien nut "Ve man hinh nhan viec moi".
function cancelledOrderError(existing) {
  const err = new ApiError(409, `Phiếu đã bị hủy. Lý do: ${existing.cancelReason || 'Không rõ lý do'}`);
  err.code = 'ORDER_CANCELLED';
  return err;
}

class RepairOrderService {
  constructor({ repairOrderRepository }) {
    this.repairOrderRepository = repairOrderRepository;
  }

  async getAll({ branchId, teamLeaderId } = {}) {
    const items = await this.repairOrderRepository.findAll({ branchId, teamLeaderId });
    return RepairOrderResponseDto.fromEntityList(items);
  }

  async getById(id) {
    const entity = await this.repairOrderRepository.findById(id);
    if (!entity) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa');
    return RepairOrderResponseDto.fromEntity(entity);
  }

  // Public - khong auth, dung cho landing page (khach nhap ma sua chua de
  // xem tien do). Tra ve DTO rut gon, khong lo thong tin khach hang.
  //
  // Chi con DUY NHAT 1 ma "RO-YYYY-NNN", cap luc tiep nhan xe va giu nguyen
  // den luc xuat hoa don. Truoc day con co them ma noi bo "LSC-..." sinh ra
  // luc to truong nhan viec (khach khong bao gio biet ma do) nen phai tra cuu
  // 2 lan - da bo han khi gop bang, xem ensureRepairOrderMerge.
  async getPublicProgressByCode(code) {
    const trimmed = (code || '').trim();
    if (!trimmed) throw new ApiError(400, 'Vui lòng nhập mã sửa chữa');

    const result = await this.repairOrderRepository.findPublicProgressByCode(trimmed);
    if (!result) throw new ApiError(404, 'Không tìm thấy mã sửa chữa này');

    return PublicRepairProgressDto.fromEntity(result);
  }


  // Tho tu nhan viec qua khoang xe (thay cho CVDV tu tay gan to truong o
  // create()) - dieu kien atomic chong 2 khoang nhan trung 1 phieu nam trong
  // repository.claim(), o day chi validate dau vao + bao 409 dung nghia neu
  // thua race.
  async claim(repairOrderId, { branchId, teamLeaderId, bayId, bayNumber }) {
    if (!repairOrderId) throw new ApiError(400, 'Thiếu phiếu quyết toán');
    if (!teamLeaderId || !bayId) throw new ApiError(400, 'Thiếu thông tin tổ trưởng/khoang xe');

    const order = await this.repairOrderRepository.findEligibleRepairOrder(repairOrderId, branchId);
    if (!order) {
      throw new ApiError(404, 'Không tìm thấy phiếu quyết toán thuộc chi nhánh của bạn');
    }
    if (order.status !== 'waiting_repair') {
      throw new ApiError(409, 'Phiếu này đã được nhận hoặc không còn ở trạng thái chờ sửa chữa');
    }

    const entity = await this.repairOrderRepository.claim(
      repairOrderId,
      { branchId, teamLeaderId, bayId, createdBy: teamLeaderId }
    );
    if (!entity) {
      throw new ApiError(409, 'Phiếu này vừa được khoang khác nhận, vui lòng chọn phiếu khác');
    }

    emitRepairOrderEvent(branchId, 'claimed', {
      teamLeaderId: entity.teamLeaderId,
      orderId: entity.id,
      code: entity.code,
      bayId,
      bayNumber,
    });

    return RepairOrderResponseDto.fromEntity(entity);
  }

  // Goi y tho may cho khoang cua to truong dang dang nhap - dung ngay sau khi
  // nhan viec, de nhap ten nguoi thuc su sua xe (xem claim() o tren). Lay ca
  // tho to khac trong chi nhanh (dieu dong), kem co same_team/busy de FE
  // hien chu thich va khoa bot nguoi dang ban.
  async searchTechnicians(teamLeaderId, branchId, search) {
    const rows = await this.repairOrderRepository.searchTechnicians(teamLeaderId, branchId, search);
    return rows.map((r) => ({
      id: r.id,
      fullName: r.user_name,
      phone: r.phone,
      sameTeam: Boolean(r.same_team),
      busy: Boolean(r.busy),
    }));
  }

  // Co the nhieu tho cung sua 1 xe - thay the toan bo danh sach moi lan goi
  // (khong phai them/bot tung nguoi), don gian cho FE gui nguyen mang da chon.
  async setTechnicians(id, technicianIds, { branchId, teamLeaderId } = {}) {
    const ids = Array.from(new Set((technicianIds || []).map(Number).filter(Boolean)));
    if (ids.length === 0) throw new ApiError(400, 'Vui lòng chọn ít nhất 1 thợ thực hiện');
    const existing = await this.repairOrderRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa');
    if (String(existing.branchId) !== String(branchId)) {
      throw new ApiError(403, 'Không có quyền thao tác trên lệnh sửa chữa của chi nhánh khác');
    }
    if (String(existing.teamLeaderId) !== String(teamLeaderId)) {
      throw new ApiError(403, 'Chỉ tổ trưởng được phân công lệnh này mới có quyền gán thợ thực hiện');
    }
    if (existing.status !== 'inprogress') {
      if (existing.status === 'cancelled') throw cancelledOrderError(existing);
      throw new ApiError(409, 'Lệnh đã kết thúc, không thể đổi thợ thực hiện');
    }

    const ok = await this.repairOrderRepository.setTechnicians(id, teamLeaderId, branchId, ids);
    if (!ok) throw new ApiError(400, 'Thợ không hợp lệ hoặc đang bận lệnh sửa chữa khác');

    // Realtime: ban dau claim() da chuyen phieu goc sang 'inprogress' ngay
    // luc chon khoang (truoc khi co tho), nhung man Phieu quyet toan cua CVDV
    // chi thuc su hien "Đang sửa chữa" tu luc co tho (xem FE displayStatus) -
    // phat lai 'claimed' (da co san trong RELEVANT_TYPES cua sseRoutes.js) de
    // CVDV thay ngay, khong doi den vong poll tiep theo.
    emitRepairOrderEvent(branchId, 'claimed', {
      teamLeaderId,
      orderId: Number(id),
      code: existing.code,
      bayId: existing.bayId,
      bayNumber: existing.bayNumber,
    });

    return this.getById(id);
  }

  async updateStatus(id, status, { branchId } = {}) {
    if (!UPDATABLE_STATUS_VALUES.includes(status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }
    const existing = await this.repairOrderRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa');
    if (String(existing.branchId) !== String(branchId)) {
      throw new ApiError(403, 'Không có quyền thao tác trên lệnh sửa chữa của chi nhánh khác');
    }
    if (existing.status !== 'inprogress') {
      if (existing.status === 'cancelled') throw cancelledOrderError(existing);
      throw new ApiError(409, 'Lệnh đã kết thúc (hoàn thành/hủy), không thể đổi trạng thái nữa');
    }
    // Chi dau muc "dich vu" (task_type='service') can tich - phu tung
    // (task_type='product') chi de hien thi, khong tinh vao dieu kien hoan thanh.
    // Dau muc bi khach huy giua chung (isCancelled) khong the tick (xem
    // updateTaskStatus/FE khoa checkbox) nen cung phai loai khoi dieu kien nay,
    // neu khong lenh se vinh vien khong hoan thanh duoc sau khi CVDV huy 1
    // hang muc - xem BayScreen.jsx/TeamLeaderDashboard.jsx allDone.
    if (status === 'completed' && !(existing.technicians || []).length) {
      throw new ApiError(409, 'Lệnh sửa chữa chưa được gán thợ thực hiện, không thể kết thúc lệnh');
    }
    if (status === 'completed' && existing.tasks.some((t) => t.taskType === 'service' && !t.isCancelled && !t.isDone)) {
      throw new ApiError(409, 'Cần tích hoàn thành tất cả đầu mục công việc trước khi kết thúc lệnh');
    }

    const entity = await this.repairOrderRepository.updateStatus(id, status);

    // Realtime: to truong vua hoan thanh toan bo lenh -> phieu quyet toan goc
    // da tu chuyen "Cho thanh toan" (xem RepairOrderRepositoryImpl.updateStatus) -
    // bao ngay cho man Phieu quyet toan cua CVDV, khong can cho poll/F5.
    emitRepairOrderEvent(branchId, 'order-completed', {
      orderId: entity.id,
      code: entity.code,
    });

    return RepairOrderResponseDto.fromEntity(entity);
  }

  async updateTaskStatus(id, taskId, isDone, { userId, branchId } = {}) {
    const existing = await this.repairOrderRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa');
    if (String(existing.branchId) !== String(branchId)) {
      throw new ApiError(403, 'Không có quyền thao tác trên lệnh sửa chữa của chi nhánh khác');
    }
    if (String(existing.teamLeaderId) !== String(userId)) {
      throw new ApiError(403, 'Chỉ tổ trưởng được phân công lệnh này mới có quyền cập nhật đầu mục');
    }
    if (existing.status !== 'inprogress') {
      if (existing.status === 'cancelled') throw cancelledOrderError(existing);
      throw new ApiError(409, 'Lệnh đã kết thúc, không thể cập nhật đầu mục công việc');
    }
    // claim() da chuyen phieu sang 'inprogress' ngay luc chon khoang, TRUOC
    // khi co tho (xem setTechnicians() ben duoi) - man CVDV chi HIEN THI
    // "Đang sửa chữa" tu luc co tho, nhung status thuc su o DB da la
    // 'inprogress' tu som hon. Neu khong chan o day, khoang xe van tich duoc
    // dau muc (va sau do hoan thanh ca lenh) du chua tung gan tho nao.
    if (!(existing.technicians || []).length) {
      throw new ApiError(409, 'Lệnh sửa chữa chưa được gán thợ thực hiện, không thể tích hoàn thành đầu mục');
    }
    const task = existing.tasks.find((t) => String(t.id) === String(taskId));
    if (!task) throw new ApiError(404, 'Không tìm thấy đầu mục công việc');
    if (task.taskType !== 'service') {
      throw new ApiError(400, 'Chỉ đầu mục dịch vụ mới cần tích hoàn thành');
    }
    // Tich xong la chot luon, khong cho tich lai/bo tich - tranh to truong
    // (hoac goi thang API) sua di sua lai trang thai da xac nhan hoan thanh.
    if (task.isDone) {
      throw new ApiError(409, 'Đầu mục này đã được xác nhận hoàn thành, không thể thay đổi lại');
    }
    if (!isDone) {
      throw new ApiError(400, 'Không thể bỏ tích đầu mục công việc');
    }

    await this.repairOrderRepository.updateTaskStatus(taskId, isDone);

    // Realtime: bao CVDV dang mo modal "Xem chi tiet" phieu quyet toan nay
    // biet ngay tien do vua thay doi, khong can F5 (xem sseRoutes.js).
    emitRepairOrderEvent(branchId, 'task-updated', {
      orderId: Number(id),
      taskId: Number(taskId),
    });

    return this.getById(id);
  }
}

module.exports = RepairOrderService;
