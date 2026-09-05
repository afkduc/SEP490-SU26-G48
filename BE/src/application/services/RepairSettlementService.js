const { PayOS } = require('@payos/node');
const ApiError = require('../../utils/ApiError');
const config = require('../../config');
const RepairSettlementResponseDto = require('../dto/RepairSettlementDto');
const { PublicVehicleHistoryDto } = RepairSettlementResponseDto;
const { emitRepairOrderEvent } = require('../events/RepairOrderEvents');
const { auditCrud } = require('../../utils/auditHelper');
const { settlementSnapshot } = require('../../utils/auditSnapshots');
const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const { isValidPhone, isValidEmail, EMAIL_HINT } = require('../../utils/fieldValidation');

// CCCD (12 so, mau moi) hoac CMND cu (9 so) - chap nhan ca 2 vi du lieu cu
// van con luu CMND 9 so.
const CCCD_REGEX = /^[0-9]{9}([0-9]{3})?$/;

let payosClient = null;
function getPayOS() {
  if (!payosClient) {
    payosClient = new PayOS({
      clientId: config.payos.clientId,
      apiKey: config.payos.apiKey,
      checksumKey: config.payos.checksumKey,
    });
  }
  return payosClient;
}

// LHSC (ten cot lich su, thuc chat la "loai hang muc") chi con phan anh noi
// dung dong (cong/vat tu); "ai tra tien" da chuyen het sang HTTT (tranh 2
// truong cung dung ma 'BH' nhung nghia khac nhau).
const LHSC_VALUES = ['DV', 'PT'];
// 'HUY' = khach huy hang muc nay giua chung (tho dang lam nhung khach khong
// muon lam nua) - mien thu khach giong BHH/BH/NB, nhung khac o cho: chi duoc
// chon khi hang muc CHUA duoc tick hoan thanh (xem update() ben duoi).
const HTTT_VALUES = ['KHT', 'BHH', 'BH', 'NB', 'HUY'];
// REPAIR_CATEGORY = "Loai hinh sua chua" THAT (dung nhu thuc te tai dai ly xe -
// khac voi LHSC o tren, vi LHSC da bi dung nham thanh "loai hang muc").
const REPAIR_CATEGORY_VALUES = ['ER', 'CB', 'EE', 'BP', 'PM'];
const EXEMPT_HTTT_VALUES = new Set(['BHH', 'BH', 'NB', 'HUY']);
const STATUS_VALUES = ['waiting_repair', 'inprogress', 'waiting_payment', 'invoiced', 'cancelled'];

// Tinh lai toan bo tong tien tu CHINH danh sach hang muc - khong tin theo
// subtotal/discountAmount/vat/total FE gui len trong payload (truoc day BE
// lay thang, ai goi API truc tiep bo qua FE co the tu khai total thap hon
// gia tri hang muc that, PayOS lai thu dung theo so nay - xem
// createPayosPaymentLink ben duoi). PHAI khop chinh xac cong thuc voi
// RepairSettlementPage.jsx calcTotals() de khong lech so voi so CVDV nhin
// thay tren man hinh truoc khi bam Luu.
function calcTotalsFromItems(items) {
  let subtotal = 0;
  let discountAmount = 0;
  let freeAmount = 0;
  for (const item of items) {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const base = qty * unitPrice;
    if (item.isFree) {
      freeAmount += base;
      continue;
    }
    if (EXEMPT_HTTT_VALUES.has(item.httt)) continue;
    const discountPct = Number(item.discount) || 0;
    subtotal += base * (1 - discountPct / 100);
    discountAmount += base * (discountPct / 100);
  }
  subtotal = Math.round(subtotal);
  discountAmount = Math.round(discountAmount);
  freeAmount = Math.round(freeAmount);
  const vat = Math.round(subtotal * 0.08);
  return { subtotal, discountAmount, afterDiscount: subtotal, vat, freeAmount, total: subtotal + vat };
}
const ACTIVE_STATUS_LABELS = {
  waiting_repair: 'chờ sửa chữa',
  inprogress: 'đang sửa chữa',
  waiting_payment: 'chờ thanh toán',
};

// So sanh 2 ban ghi phieu (truoc/sau 1 lan sua) de "Nhat ky hoat dong phieu"
// hien ro sua CAI GI thanh CAI GI thay vi chi 1 dong mo ta chung chung - can
// thiet voi phieu nhieu hang muc (theo yeu cau CVDV: "phiếu lớn thì xem không
// biết là họ sửa gì"). Ghep hang muc theo code (hoac theo mo ta neu khong co
// code) vi item id KHONG on dinh qua moi lan luu - repository.update() xoa
// het roi chen lai toan bo repair_order_items (xem
// RepairSettlementRepositoryImpl.update), nen khong the doi chieu theo id.
const SETTLEMENT_DIFF_FIELDS = [
  { key: 'customerRequest', label: 'Yêu cầu khách hàng' },
  { key: 'note', label: 'Ghi chú' },
  { key: 'currentKm', label: 'Số km hiện tại' },
];
const ITEM_DIFF_FIELDS = [
  { key: 'qty', label: 'Số lượng' },
  { key: 'unitPrice', label: 'Đơn giá' },
  { key: 'discount', label: 'Chiết khấu (%)' },
  { key: 'httt', label: 'Hình thức thanh toán' },
  { key: 'isFree', label: 'Miễn phí' },
  { key: 'note', label: 'Ghi chú hạng mục' },
];
function itemDiffKey(it) {
  return (it.code && String(it.code).trim()) || `desc:${String(it.description || '').trim().toLowerCase()}`;
}
function diffSettlementForActivityLog(before, after) {
  const changes = [];
  for (const { key, label } of SETTLEMENT_DIFF_FIELDS) {
    const b = before?.[key] ?? null;
    const a = after?.[key] ?? null;
    if (String(b ?? '') !== String(a ?? '')) {
      changes.push({ type: 'field', label, before: b, after: a });
    }
  }

  const beforeMap = new Map((before?.items || []).map((it) => [itemDiffKey(it), it]));
  const afterMap = new Map((after?.items || []).map((it) => [itemDiffKey(it), it]));

  for (const [key, it] of afterMap) {
    if (!beforeMap.has(key)) {
      changes.push({ type: 'item_added', label: it.description || it.code || 'Hạng mục', qty: it.qty, unitPrice: it.unitPrice });
    }
  }
  for (const [key, it] of beforeMap) {
    if (!afterMap.has(key)) {
      changes.push({ type: 'item_removed', label: it.description || it.code || 'Hạng mục', qty: it.qty, unitPrice: it.unitPrice });
    }
  }
  for (const [key, b] of beforeMap) {
    const a = afterMap.get(key);
    if (!a) continue;
    const fields = [];
    for (const { key: fk, label: fl } of ITEM_DIFF_FIELDS) {
      const bv = b[fk];
      const av = a[fk];
      if (String(bv ?? '') !== String(av ?? '')) {
        fields.push({ key: fk, label: fl, before: bv, after: av });
      }
    }
    if (fields.length) {
      changes.push({ type: 'item_changed', label: b.description || b.code || 'Hạng mục', fields });
    }
  }

  return changes;
}

class RepairSettlementService {
  constructor({ repairSettlementRepository, customerRepository }) {
    this.repairSettlementRepository = repairSettlementRepository;
    this.customerRepository = customerRepository;
  }

  async getAll({ branchId, status, search, customerId, vehicleId, fromDate, toDate, advisorId, page, limit } = {}) {
    const [items, total] = await Promise.all([
      this.repairSettlementRepository.findAll({ branchId, status, search, customerId, vehicleId, fromDate, toDate, advisorId, page, limit }),
      this.repairSettlementRepository.count({ branchId, status, search, customerId, vehicleId, fromDate, toDate, advisorId }),
    ]);
    return {
      items: RepairSettlementResponseDto.fromEntityList(items),
      total,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    };
  }

  // Khong gioi han theo advisorId o day: getById con duoc dung de xem chi tiet
  // 1 phieu tu man "Lich su dich vu" cua khach hang/xe (co the do co van KHAC
  // phu trach) - man do co tinh chat tra cuu dung chung, phai xem duoc het.
  // Rieng danh sach chinh (getAll) moi gioi han "chi xem cua ban than".
  async getById(id) {
    const entity = await this.repairSettlementRepository.findById(id);
    if (!entity) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    return RepairSettlementResponseDto.fromEntity(entity);
  }

  // Chiem khoa "dang mo phieu" (man danh sach Phieu quyet toan - nut "Truy
  // cap phieu") - chan 2 CVDV cung sua 1 phieu 1 luc. FE goi lai moi 20s de
  // gia han trong luc con mo (xem RepairSettlementRepositoryImpl.acquireLock,
  // LOCK_TTL_SECONDS); chi ghi 1 dong "Truy cap phieu" vao nhat ky khi la lan
  // CHIEM MOI that su (fresh), khong ghi lap lai moi nhip gia han.
  async acquireLock(id, req) {
    const userId = req?.user?.userId;
    const branchId = req?.user?.branchId;
    // Nhip gia han goi lai moi 20s trong luc mo - danh dau ngay tu day de
    // auditMiddleware (log chung moi request POST/PUT/PATCH/DELETE) khong tu
    // ghi them 1 dong audit_logs rac moi 20s; lan CHIEM MOI (fresh) van duoc
    // ghi rieng 1 dong "Truy cap phieu" o duoi (auditLifecycle tu set lai co
    // nay, khong xung dot).
    if (req) req._manualAuditWritten = true;
    const result = await this.repairSettlementRepository.acquireLock(id, userId);
    if (!result.ok) {
      const err = new ApiError(409, `Phiếu đang được ${result.lockedByName || 'người khác'} mở, vui lòng thử lại sau`);
      err.details = {
        lockedByUserId: result.lockedByUserId,
        lockedByName: result.lockedByName,
        lockedAt: result.lockedAt,
      };
      throw err;
    }
    if (result.fresh) {
      const item = await this.repairSettlementRepository.findById(id);
      await auditCrud.lifecycle(req, {
        tableName: 'repair_settlements',
        entityCode: item?.code || `ID-${id}`,
        recordId: item?.id || Number(id) || null,
        entityName: 'Phiếu quyết toán',
        step: 'accessed',
        stepLabel: 'Truy cập phiếu',
        action: 'UPDATE',
        description: `Phiếu quyết toán ${item?.code || id}: truy cập`,
        snapshot: settlementSnapshot(item),
      });
      if (branchId) emitRepairOrderEvent(branchId, 'locked', { orderId: Number(id) });
    }
    return { ok: true };
  }

  // Nha khoa khi CVDV dong phieu dang xem (hoac component unmount) - best
  // effort, khong throw neu khong con giu khoa (vd het han roi bi nguoi khac
  // chiem truoc) vi releaseLock() chi xoa dung khi con la chinh minh dang giu.
  async releaseLock(id, req) {
    const userId = req?.user?.userId;
    const branchId = req?.user?.branchId;
    // Nha khoa la thao tac phu, khong can hien trong audit_logs chung.
    if (req) req._manualAuditWritten = true;
    await this.repairSettlementRepository.releaseLock(id, userId);
    if (branchId) emitRepairOrderEvent(branchId, 'unlocked', { orderId: Number(id) });
    return { ok: true };
  }

  // Nhat ky hoat dong cua 1 phieu ("Nhat ky hoat dong phieu") - tai su dung
  // dung audit log dang "lifecycle" da co san (1 dong/1 phieu, gom mang cac
  // buoc tao/sua/doi trang thai/in/truy cap - xem auditHelper.auditLifecycle),
  // khong tao bang rieng.
  async getActivityLog(id) {
    const log = await AuditRepository.findLifecycleAuditLog('repair_settlements', id);
    if (!log?.new_value) return [];
    try {
      const parsed = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value;
      return Array.isArray(parsed?.steps) ? parsed.steps : [];
    } catch {
      return [];
    }
  }

  // Public - khong dang nhap (xem publicRoutes.js), khong duoc dung req.user o
  // day. Khach nhap bien so HOAC so khung - xe doi bien van tra duoc bang so
  // khung. Tra ve null (khong phai loi) neu khong tim thay, de FE hien "khong
  // co ket qua" thay vi phan biet "sai bien so" hay "chua tung sua o day" -
  // tranh lo viec 1 bien so co ton tai trong he thong hay khong.
  async getPublicHistoryByPlateOrFrame(identifier) {
    const trimmed = (identifier || '').trim();
    if (!trimmed) throw new ApiError(400, 'Vui lòng nhập biển số xe hoặc số khung');

    const rows = await this.repairSettlementRepository.findPublicHistoryByVehicleIdentifier(trimmed);
    return PublicVehicleHistoryDto.fromRows(rows);
  }

  // Chu ky dien tu tai cho (nguoi lien he ky truc tiep len man hinh CVDV luc
  // chot phieu) - bang chung xac nhan dong y, chi bat buoc luc TAO phieu, sua
  // phieu sau do khong doi lai chu ky goc.
  _assertSignaturePresent(signatureData) {
    if (!(signatureData || '').startsWith('data:image/png;base64,')) {
      throw new ApiError(400, 'Vui lòng ký xác nhận trước khi lưu phiếu');
    }
  }

  // CVDV go tay khach hang/xe MOI (khong chon tu goi y tra cuu DB co san) -
  // payload luc do khong co customerId/vehicleId, chi co payload.customer/
  // payload.vehicle (thong tin tho). Tu tim-hoac-tao khach hang (theo SDT) va
  // xe (theo bien so) that trong DB, gan lai id vao payload de cac buoc sau
  // xu ly binh thuong nhu da chon tu tra cuu. Neu payload da co san
  // customerId/vehicleId (duong tra cuu cu) thi bo qua, giu nguyen hanh vi cu.
  async _resolveCustomerAndVehicle(payload) {
    if (payload.customerId && payload.vehicleId) return payload;

    const customer = payload.customer || {};
    const vehicle = payload.vehicle || {};
    if (!(customer.fullName || '').trim() || !(customer.phone || '').trim()) {
      throw new ApiError(400, 'Phải nhập tên và số điện thoại khách hàng');
    }
    if (!(vehicle.licensePlate || '').trim()) {
      throw new ApiError(400, 'Phải nhập biển số xe');
    }
    if (!isValidPhone(customer.phone)) {
      throw new ApiError(400, 'Số điện thoại khách hàng không hợp lệ');
    }
    if ((customer.contactPhone || '').trim() && !isValidPhone(customer.contactPhone)) {
      throw new ApiError(400, 'Số điện thoại người liên hệ không hợp lệ');
    }
    if ((customer.email || '').trim() && !isValidEmail(customer.email)) {
      throw new ApiError(400, EMAIL_HINT);
    }
    if ((customer.cccd || '').trim() && !CCCD_REGEX.test(customer.cccd.trim())) {
      throw new ApiError(400, 'Số CCCD/CMND không hợp lệ (phải là 9 hoặc 12 chữ số)');
    }

    const { customerId, vehicleId } = await this.customerRepository.findOrCreateForSettlement({
      fullName: customer.fullName.trim(),
      phone: customer.phone.trim(),
      address: customer.address || null,
      taxCode: customer.taxCode || null,
      cccd: customer.cccd || null,
      email: customer.email || null,
      contactName: customer.contactPerson || null,
      contactPhone: customer.contactPhone || null,
      licensePlate: vehicle.licensePlate.trim(),
      vehicleModelText: vehicle.vehicleModel || null,
      modelId: vehicle.modelId || null,
      frameNumber: vehicle.frameNumber || null,
      engineNumber: vehicle.engineNumber || null,
      currentKm: payload.currentKm || null,
      purchaseDate: vehicle.purchaseDate || null,
    });

    return { ...payload, customerId, vehicleId };
  }

  async create(payload, { branchId, advisorId }) {
    this._assertSignaturePresent(payload.signatureData);
    const resolvedPayload = await this._resolveCustomerAndVehicle(payload);
    const data = this._validateAndNormalize(resolvedPayload);
    data.signatureData = payload.signatureData;
    data.signerName = (payload.signerName || '').trim() || null;
    await this._assertNoActiveDuplicate(data.customerId, data.vehicleId);
    const entity = await this.repairSettlementRepository.create(data, { branchId, advisorId });

    // Realtime: phieu moi luon o trang thai waiting_repair luc vua tao - bao
    // ngay cho bang tin cac khoang xe trong chi nhanh (xem VehicleBayService),
    // khong can cho poll/F5.
    emitRepairOrderEvent(branchId, 'new-pending', { orderId: entity.id });

    return RepairSettlementResponseDto.fromEntity(entity);
  }

  async update(id, payload) {
    const existing = await this.repairSettlementRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    if (existing.status === 'invoiced') {
      throw new ApiError(409, 'Phiếu đã xuất hóa đơn, không thể chỉnh sửa');
    }
    // Truoc day chi chan 'invoiced' - 'waiting_payment' (to truong/tho da
    // hoan thanh xong lenh sua chua, dang cho khach thanh toan) va 'cancelled'
    // lot qua khong bi chan, cho phep sua hang muc/tong tien sau khi da
    // "chot" xong (vd CVDV van dang mo san man Chinh sua tu luc phieu con
    // 'inprogress', luc luu thi phieu da tu chuyen 'waiting_payment' o phia
    // to truong roi) - de lai sai lech tien voi QR/lien ket PayOS da tao
    // truoc do. Chi cho sua khi con dang xu ly ('waiting_repair'/'inprogress').
    if (existing.status !== 'waiting_repair' && existing.status !== 'inprogress') {
      throw new ApiError(409, 'Phiếu đã hoàn thành sửa chữa hoặc đã hủy, không thể chỉnh sửa nữa');
    }

    const data = this._validateAndNormalize(payload);
    await this._assertNoActiveDuplicate(data.customerId, data.vehicleId, id);

    // Khong tin rieng FE (co the chan nham/thieu do bug hien thi) - kiem tra
    // lai o day: doi HTTT/xoa hang muc trong payload nay co lam mat 1 dau muc
    // DA duoc tick hoan thanh hay khong.
    const wouldLose = await this.repairSettlementRepository.wouldLoseCompletedTasks(id, data.items);
    if (wouldLose) {
      throw new ApiError(409, 'Có đầu mục công việc đã được xác nhận hoàn thành, không thể hủy hoặc xóa hạng mục tương ứng nữa');
    }

    const entity = await this.repairSettlementRepository.update(id, data);

    // Realtime: neu phieu dang co lenh sua chua "inprogress" (da co to
    // truong/tho), sua hang muc (vd khach huy giua chung) co the lam checklist
    // thay doi (bot dau muc) - bao ngay cho dashboard to truong + man khoang
    // xe cong khai, khong doi ho tu F5 moi thay dau muc da bien mat.
    if (existing.repairOrderId) {
      emitRepairOrderEvent(existing.branchId, 'task-updated', {
        orderId: entity.id,
        taskId: null,
      });
    }

    return { item: RepairSettlementResponseDto.fromEntity(entity), changes: diffSettlementForActivityLog(existing, entity) };
  }

  // 1 khach hang + 1 xe chi duoc co toi da 1 phieu quyet toan dang xu ly
  // (chua huy, chua xuat hoa don) tai 1 thoi diem.
  async _assertNoActiveDuplicate(customerId, vehicleId, excludeId) {
    const conflict = await this.repairSettlementRepository.findActiveByCustomerVehicle(customerId, vehicleId, excludeId);
    if (conflict) {
      throw new ApiError(409, this._buildDuplicateMessage(conflict));
    }
  }

  _buildDuplicateMessage(conflict) {
    const label = ACTIVE_STATUS_LABELS[conflict.status] || conflict.status;
    return `Khách hàng và xe này đang có phiếu quyết toán ${conflict.code} (${label}) chưa xử lý xong. Vui lòng hủy hoặc hoàn tất phiếu đó trước khi tạo phiếu mới.`;
  }

  // Cho FE goi ngay sau khi chon xong khach hang + xe (truoc khi nhap hang
  // muc, truoc khi luu) de bao trung ngay, khong phai doi den luc bam Luu
  // moi biet - tra ve null neu khong trung, tranh phai bat loi 409.
  async checkActiveDuplicate(customerId, vehicleId, excludeId) {
    if (!customerId || !vehicleId) return null;
    const conflict = await this.repairSettlementRepository.findActiveByCustomerVehicle(customerId, vehicleId, excludeId);
    if (!conflict) return null;
    return { code: conflict.code, status: conflict.status, message: this._buildDuplicateMessage(conflict) };
  }

  async updateStatus(id, status, { issuedBy, cancelReason } = {}) {
    if (!STATUS_VALUES.includes(status)) {
      throw new ApiError(400, 'Trạng thái không hợp lệ');
    }
    const existing = await this.repairSettlementRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    if (existing.status === 'invoiced') {
      throw new ApiError(409, 'Phiếu đã xuất hóa đơn, không thể đổi trạng thái');
    }
    if (status === 'cancelled') {
      if (!['waiting_repair', 'inprogress'].includes(existing.status)) {
        throw new ApiError(409, 'Chỉ có thể hủy phiếu khi đang ở trạng thái chờ sửa chữa hoặc đang sửa chữa');
      }
      // Dang sua chua nhung chua tick xong dau muc nao thi van huy duoc binh
      // thuong (chua lam gi thuc te) - da co it nhat 1 dau muc duoc xac nhan
      // hoan thanh thi khong cho huy nua, tranh mat cong to truong/tho da lam.
      if (existing.status === 'inprogress' && (existing.tasks || []).some((t) => t.isDone)) {
        throw new ApiError(409, 'Đã có đầu mục công việc được xác nhận hoàn thành, không thể hủy phiếu này nữa');
      }
      if (!(cancelReason || '').trim()) {
        throw new ApiError(400, 'Phải nhập lý do hủy');
      }
    }

    // Xuat hoa don qua duong nay (khong phai webhook PayOS) chi co the la CVDV
    // bam "Xac nhan da thu tien mat" tren man In phieu, nen luon ghi nhan CASH
    // - duong PayOS (chuyen khoan that) di rieng qua handlePayosWebhook() ben
    // duoi, khong bao gio goi ham nay.
    if (status === 'invoiced' && existing.status !== 'waiting_payment') {
      throw new ApiError(409, 'Phiếu phải ở trạng thái chờ thanh toán mới có thể xác nhận thanh toán');
    }

    const entity = await this.repairSettlementRepository.updateStatus(id, status, {
      issuedBy,
      cancelReason,
      paymentMethod: status === 'invoiced' ? 'CASH' : undefined,
    });

    // CVDV vua xac nhan thu tien mat - bao realtime giong het duong PayOS
    // webhook (xem handlePayosWebhook), de danh sach/modal dang mo tu chuyen
    // sang tab "Đã xuất hóa đơn" ngay, khong doi F5.
    if (status === 'invoiced') {
      emitRepairOrderEvent(existing.branchId, 'invoiced', { orderId: entity.id });
    }

    // Huy giua chung - neu da co to truong nhan (existing.repairOrderId), BE
    // da tu dong huy luon lenh sua chua cascade (xem
    // RepairSettlementRepositoryImpl.updateStatus) thay vi tra ve "waiting_repair"
    // de nhan lai nhu truoc. Luon bao realtime toan chi nhanh: khoang dang
    // hien DUNG lenh nay (orderId khop) hien ngay banner huy kem ly do, con
    // cac khoang dang hien no trong bang tin "Viec moi" (chua ai nhan) thi tu
    // xoa dong tuong ung - xem TeamLeaderKiosk.jsx handleEvent 'order-cancelled'.
    if (status === 'cancelled') {
      emitRepairOrderEvent(existing.branchId, 'order-cancelled', {
        orderId: entity.id,
        cancelReason,
      });
    }

    // Xuat hoa don thu cong (CVDV xac nhan thanh toan tien mat qua nut doi
    // trang thai) - khac voi handlePayosWebhook() o duoi, truong hop nay
    // truoc gio CHUA bao realtime cho ai (Dashboard/cac man theo doi khac se
    // khong tu cap nhat neu thieu dong nay).
    if (status === 'invoiced') {
      emitRepairOrderEvent(existing.branchId, 'invoiced', { orderId: entity.id });
    }

    return RepairSettlementResponseDto.fromEntity(entity);
  }

  // ─── Man hinh bao ve tai cong (public, khong dang nhap) ───────────
  // Thay the "In phieu xe ra" giay - xe da xuat hoa don (status='invoiced')
  // ma chua xac nhan ra cong (delivery_date con NULL) thi hien o day cho
  // bao ve doi chieu roi bam xac nhan.
  async getGatePending(branchId) {
    const rows = await this.repairSettlementRepository.findGatePending(branchId);
    return rows.map((r) => ({
      id: r.id,
      code: r.repair_code,
      customerName: r.customer_full_name,
      vehiclePlate: r.vehicle_license_plate,
      vehicleModel: r.vehicle_model_text,
    }));
  }

  async confirmGateExit(id, branchId) {
    const ok = await this.repairSettlementRepository.confirmGateExit(id, branchId);
    if (!ok) throw new ApiError(409, 'Phiếu không tồn tại, không thuộc chi nhánh này, hoặc đã được xác nhận ra cổng trước đó');
    emitRepairOrderEvent(branchId, 'gate-exit-confirmed', { orderId: Number(id) });
    return { id: Number(id) };
  }

  // ─── PayOS ───────────────────────────────────────────────────────
  // Tao link/QR dong cho phieu dang cho thanh toan - goi tu dong ngay khi
  // CVDV mo modal "In phieu va xuat hoa don" (xem SettlementPreviewModal o
  // FE). Het han sau 60s (test nhanh theo yeu cau) - moi lan goi la 1
  // orderCode moi (Date.now()), khong tai su dung orderCode cu vi PayOS bat
  // buoc orderCode duy nhat.
  async createPayosPaymentLink(id, req = {}) {
    const existing = await this.repairSettlementRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    if (existing.status !== 'waiting_payment') {
      throw new ApiError(409, 'Phiếu không ở trạng thái chờ thanh toán');
    }

    const orderCode = Date.now();
    const expiredAtUnix = Math.floor(Date.now() / 1000) + 60;
    const amount = Math.round(existing.total || 0);

    const paymentLink = await getPayOS().paymentRequests.create({
      orderCode,
      amount,
      description: `TT ${existing.code}`.slice(0, 25),
      cancelUrl: `${config.frontendUrl}/repair-settlements`,
      returnUrl: `${config.frontendUrl}/repair-settlements`,
      expiredAt: expiredAtUnix,
      buyerName: existing.customer?.fullName || undefined,
    });

    await this.repairSettlementRepository.createPayosTransaction(id, {
      orderCode,
      paymentLinkId: paymentLink.paymentLinkId,
      qrCode: paymentLink.qrCode,
      checkoutUrl: paymentLink.checkoutUrl,
      amount,
      expiredAt: new Date(expiredAtUnix * 1000),
    });

    await auditCrud.lifecycle(req, {
      tableName: 'repair_settlements',
      entityCode: existing.code,
      recordId: Number(id),
      entityName: 'Phiếu quyết toán',
      step: 'payos_link',
      stepLabel: 'Tạo mã QR thanh toán',
      action: 'UPDATE',
      description: `Phiếu quyết toán ${existing.code}: tạo QR PayOS ${amount.toLocaleString('vi-VN')}đ`,
      snapshot: settlementSnapshot(existing, { orderCode, amount, status: existing.status }),
      branchId: existing.branchId,
    });

    return {
      qrCode: paymentLink.qrCode,
      checkoutUrl: paymentLink.checkoutUrl,
      orderCode,
      expiredAt: expiredAtUnix,
    };
  }

  // Webhook PayOS bao da nhan tien - TU DONG xuat hoa don luon (khong doi
  // CVDV bam xac nhan, theo dung yeu cau "thanh toan that"). Idempotent: bo
  // qua neu khong tim thay transaction, da 'paid' roi, hoac phieu khong con
  // o 'waiting_payment' (vd CVDV da xac nhan tay truoc do) - vi PayOS co the
  // goi lai webhook nhieu lan cho cung 1 giao dich.
  async handlePayosWebhook(rawBody, req = {}) {
    const webhookData = await getPayOS().webhooks.verify(rawBody);

    const tx = await this.repairSettlementRepository.findPayosTransactionByOrderCode(webhookData.orderCode);
    if (!tx || tx.status === 'paid') return;

    await this.repairSettlementRepository.markPayosTransactionPaid(webhookData.orderCode, {
      reference: webhookData.reference,
      paidAt: new Date(),
    });

    const settlement = await this.repairSettlementRepository.findById(tx.repair_order_id);
    if (!settlement || settlement.status !== 'waiting_payment') return;

    await this.repairSettlementRepository.updateStatus(tx.repair_order_id, 'invoiced', { issuedBy: settlement.advisorId, paymentMethod: 'TRANSFER' });
    emitRepairOrderEvent(settlement.branchId, 'invoiced', { orderId: tx.repair_order_id });

    // Ghi audit sau khi xuat hoa don — khong doi logic thanh toan.
    // Webhook khong co JWT: actor = system. requestBody rut gon (khong luu chu ky PayOS).
    await auditCrud.lifecycle(req, {
      tableName: 'repair_settlements',
      entityName: 'Phiếu quyết toán',
      entityCode: settlement.code || `ID-${tx.repair_order_id}`,
      recordId: tx.repair_order_id,
      step: 'paid',
      stepLabel: 'Khách hàng thanh toán (PayOS)',
      action: 'UPDATE',
      description: `Phiếu quyết toán ${settlement.code || tx.repair_order_id}: khách thanh toán ${(Number(tx.amount) || 0).toLocaleString('vi-VN')}đ qua PayOS — đã xuất hóa đơn`,
      snapshot: settlementSnapshot(settlement, {
        status: 'invoiced',
        amount: tx.amount,
        reference: webhookData.reference || null,
        orderCode: webhookData.orderCode,
      }),
      responseStatus: 200,
      branchId: settlement.branchId,
    });
  }

  _validateAndNormalize(payload) {
    if (!payload.customerId || !payload.vehicleId) {
      throw new ApiError(400, 'Phải chọn khách hàng và xe từ gợi ý tra cứu');
    }
    if (payload.currentKm === '' || payload.currentKm == null) {
      throw new ApiError(400, 'Phải nhập số km hiện tại của xe');
    }
    if (!(payload.customerRequest || '').trim()) {
      throw new ApiError(400, 'Phải nhập mô tả yêu cầu của khách hàng');
    }

    const items = (payload.items || []).filter((i) => (i.description || '').trim().length > 0);
    if (items.length === 0) {
      throw new ApiError(400, 'Phải có ít nhất 1 hạng mục công việc/phụ tùng');
    }
    if (!items.some((i) => Number(i.unitPrice) > 0)) {
      throw new ApiError(400, 'Phải có ít nhất 1 hạng mục có đơn giá lớn hơn 0');
    }
    for (const item of items) {
      if (!LHSC_VALUES.includes(item.lhsc)) {
        throw new ApiError(400, `Loại hạng mục không hợp lệ: ${item.lhsc}`);
      }
      if (!HTTT_VALUES.includes(item.httt)) {
        throw new ApiError(400, `Hình thức thanh toán không hợp lệ: ${item.httt}`);
      }
      if (!REPAIR_CATEGORY_VALUES.includes(item.repairCategory)) {
        throw new ApiError(400, `Loại hình sửa chữa không hợp lệ: ${item.repairCategory}`);
      }
      // So luong: phu tung (PT) hoac hang muc DA HUY duoc phep = 0 (huy giua
      // chung luon ve 0, xem FE handleCancelItem) - dich vu (DV) con hieu luc
      // thi phai >= 1, khong co "0 cong" ma van tinh la 1 dau muc that.
      const minQty = (item.lhsc === 'PT' || item.httt === 'HUY') ? 0 : 1;
      const qtyNum = Number(item.qty);
      if (!Number.isFinite(qtyNum) || qtyNum < minQty) {
        throw new ApiError(400, `Số lượng không hợp lệ ở hạng mục "${item.description}"`);
      }
      const unitPriceNum = Number(item.unitPrice);
      if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) {
        throw new ApiError(400, `Đơn giá không hợp lệ ở hạng mục "${item.description}"`);
      }
      const discountNum = Number(item.discount) || 0;
      if (discountNum < 0 || discountNum > 100) {
        throw new ApiError(400, `Chiết khấu phải trong khoảng 0-100% ở hạng mục "${item.description}"`);
      }
    }

    return {
      customerId: payload.customerId,
      vehicleId: payload.vehicleId,
      customerRequest: payload.customerRequest || null,
      note: payload.note || null,
      currentKm: payload.currentKm ? Number(payload.currentKm) : null,
      ...calcTotalsFromItems(items),
      items,
      intakeChecklist: payload.intakeChecklist || null,
    };
  }
}

module.exports = RepairSettlementService;
