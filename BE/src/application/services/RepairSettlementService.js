const { PayOS } = require('@payos/node');
const ApiError = require('../../utils/ApiError');
const config = require('../../config');
const RepairSettlementResponseDto = require('../dto/RepairSettlementDto');
const { emitRepairOrderEvent } = require('../events/RepairOrderEvents');

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
const HTTT_VALUES = ['KHT', 'BHH', 'BH', 'NB'];
// REPAIR_CATEGORY = "Loai hinh sua chua" THAT (dung nhu thuc te tai dai ly xe -
// khac voi LHSC o tren, vi LHSC da bi dung nham thanh "loai hang muc").
const REPAIR_CATEGORY_VALUES = ['ER', 'CB', 'EE', 'BP', 'PM'];
const STATUS_VALUES = ['waiting_repair', 'inprogress', 'waiting_payment', 'invoiced', 'cancelled'];
const ACTIVE_STATUS_LABELS = {
  waiting_repair: 'chờ sửa chữa',
  inprogress: 'đang sửa chữa',
  waiting_payment: 'chờ thanh toán',
};

class RepairSettlementService {
  constructor({ repairSettlementRepository }) {
    this.repairSettlementRepository = repairSettlementRepository;
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

  async create(payload, { branchId, advisorId }) {
    const data = this._validateAndNormalize(payload);
    await this._assertNoActiveDuplicate(data.customerId, data.vehicleId);
    const entity = await this.repairSettlementRepository.create(data, { branchId, advisorId });
    return RepairSettlementResponseDto.fromEntity(entity);
  }

  async update(id, payload) {
    const existing = await this.repairSettlementRepository.findById(id);
    if (!existing) throw new ApiError(404, 'Không tìm thấy phiếu quyết toán');
    if (existing.status === 'invoiced') {
      throw new ApiError(409, 'Phiếu đã xuất hóa đơn, không thể chỉnh sửa');
    }

    const data = this._validateAndNormalize(payload);
    await this._assertNoActiveDuplicate(data.customerId, data.vehicleId, id);
    const entity = await this.repairSettlementRepository.update(id, data);
    return RepairSettlementResponseDto.fromEntity(entity);
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
      if (existing.status !== 'waiting_repair') {
        throw new ApiError(409, 'Chỉ có thể hủy phiếu khi đang ở trạng thái chờ sửa chữa (chưa phân công tổ trưởng)');
      }
      if (!(cancelReason || '').trim()) {
        throw new ApiError(400, 'Phải nhập lý do hủy');
      }
    }

    const entity = await this.repairSettlementRepository.updateStatus(id, status, { issuedBy, cancelReason });
    return RepairSettlementResponseDto.fromEntity(entity);
  }

  // ─── PayOS ───────────────────────────────────────────────────────
  // Tao link/QR dong cho phieu dang cho thanh toan - goi tu dong ngay khi
  // CVDV mo modal "In phieu va xuat hoa don" (xem SettlementPreviewModal o
  // FE). Het han sau 60s (test nhanh theo yeu cau) - moi lan goi la 1
  // orderCode moi (Date.now()), khong tai su dung orderCode cu vi PayOS bat
  // buoc orderCode duy nhat.
  async createPayosPaymentLink(id) {
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

    return { qrCode: paymentLink.qrCode, checkoutUrl: paymentLink.checkoutUrl, orderCode, expiredAt: expiredAtUnix };
  }

  // Webhook PayOS bao da nhan tien - TU DONG xuat hoa don luon (khong doi
  // CVDV bam xac nhan, theo dung yeu cau "thanh toan that"). Idempotent: bo
  // qua neu khong tim thay transaction, da 'paid' roi, hoac phieu khong con
  // o 'waiting_payment' (vd CVDV da xac nhan tay truoc do) - vi PayOS co the
  // goi lai webhook nhieu lan cho cung 1 giao dich.
  async handlePayosWebhook(rawBody) {
    const webhookData = await getPayOS().webhooks.verify(rawBody);

    const tx = await this.repairSettlementRepository.findPayosTransactionByOrderCode(webhookData.orderCode);
    if (!tx || tx.status === 'paid') return;

    await this.repairSettlementRepository.markPayosTransactionPaid(webhookData.orderCode, {
      reference: webhookData.reference,
      paidAt: new Date(),
    });

    const settlement = await this.repairSettlementRepository.findById(tx.service_order_id);
    if (!settlement || settlement.status !== 'waiting_payment') return;

    await this.repairSettlementRepository.updateStatus(tx.service_order_id, 'invoiced', { issuedBy: settlement.advisorId });
    emitRepairOrderEvent(settlement.branchId, 'invoiced', { settlementId: tx.service_order_id });
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
    }

    return {
      customerId: payload.customerId,
      vehicleId: payload.vehicleId,
      customerRequest: payload.customerRequest || null,
      currentKm: payload.currentKm ? Number(payload.currentKm) : null,
      subtotal: payload.subtotal,
      discountAmount: payload.discountAmount,
      afterDiscount: payload.afterDiscount,
      vat: payload.vat,
      freeAmount: payload.freeAmount,
      total: payload.total,
      items,
    };
  }
}

module.exports = RepairSettlementService;
