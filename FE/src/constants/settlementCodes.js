// Mã dùng trên phiếu quyết toán: LHSC (loại hình sửa chữa) và HTTT (hình
// thức thanh toán).
//
// Hai bảng này trước đây bị chép lại ở nhiều nơi (RepairSettlementPage,
// ManagerPage) kèm ghi chú "phải giữ đồng bộ", còn màn Quản lý / Tổng giám
// đốc và BẢN IN thì đổ thẳng mã thô ra giấy — khách cầm phiếu thấy "CB",
// "PM", "KHT" mà không hiểu là gì. Gom về một chỗ để mọi màn hình đọc cùng
// một nguồn.
//
// LƯU Ý: `value` là mã ĐANG LƯU TRONG DATABASE (repair_order_items.repair_category
// / .httt) và có trong tài liệu Data Dictionary — không đổi. Muốn hiển thị
// khác thì sửa `label`, đừng sửa `value`.

// ─── LHSC: bản chất công việc sửa chữa (không liên quan ai trả tiền) ───────
export const REPAIR_CATEGORY_OPTIONS = [
  { value: 'ER', label: 'Sửa chữa động cơ' },
  { value: 'CB', label: 'Sửa chữa gầm' },
  { value: 'EE', label: 'Sửa chữa điện - điện tử' },
  { value: 'BP', label: 'Đồng sơn' },
  { value: 'PM', label: 'Bảo dưỡng định kỳ' },
  { value: 'CS', label: 'Chăm sóc xe' },
];

export const REPAIR_CATEGORY_LABEL_BY_VALUE = Object.fromEntries(
  REPAIR_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);

// ─── HTTT: nơi DUY NHẤT xác định ai trả tiền cho dòng này ──────────────────
// "Hợp đồng bảo dưỡng" (gói trả trước, dùng nhiều lần) chưa có bảng theo dõi
// số dư nên tạm chưa đưa vào đây - tránh cho chọn 1 lựa chọn "miễn phí" mà
// không có gì kiểm chứng.
export const HTTT_OPTIONS = [
  { value: 'KHT', label: 'Khách hàng thanh toán' },
  { value: 'BHH', label: 'Bảo hành hãng xe' },
  { value: 'BH', label: 'Bảo hiểm chi trả' },
  { value: 'NB', label: 'Nội bộ chịu phí' },
];

// "Khách hủy" - khách đang sửa nửa chừng thì kêu hủy 1 hạng mục (không phải
// hủy cả phiếu). KHÔNG nằm trong HTTT_OPTIONS (danh sách chọn bình thường) vì
// chỉ được phép chọn khi: đang ở màn Chỉnh sửa phiếu "đang sửa chữa" VÀ hạng
// mục đó CHƯA được tổ trưởng/thợ tick hoàn thành.
export const HTTT_CANCELLED_VALUE = 'HUY';
export const HTTT_CANCELLED_OPTION = { value: HTTT_CANCELLED_VALUE, label: 'Khách hủy' };

export const HTTT_LABEL_BY_VALUE = Object.fromEntries(
  [...HTTT_OPTIONS, HTTT_CANCELLED_OPTION].map((o) => [o.value, o.label])
);

// Nhãn ngắn cho các cột hẹp (bản in A4 có 11 cột, modal xem trước có 9) - đủ
// nghĩa để khách đọc hiểu mà không đẩy bảng vỡ khổ giấy như nhãn đầy đủ.
export const REPAIR_CATEGORY_SHORT_LABEL = {
  ER: 'Động cơ',
  CB: 'Gầm',
  EE: 'Điện',
  BP: 'Đồng sơn',
  PM: 'Bảo dưỡng',
  CS: 'Chăm sóc xe',
};

export const HTTT_SHORT_LABEL = {
  KHT: 'Khách trả',
  BHH: 'Bảo hành hãng',
  BH: 'Bảo hiểm',
  NB: 'Nội bộ',
  [HTTT_CANCELLED_VALUE]: 'Khách hủy',
};

/** Nhãn LHSC cho cột hẹp / bản in. Không có mã thì trả '—' chứ không trả mã thô. */
export function repairCategoryShort(code) {
  return REPAIR_CATEGORY_SHORT_LABEL[code] || REPAIR_CATEGORY_LABEL_BY_VALUE[code] || '—';
}

/** Nhãn HTTT cho cột hẹp / bản in. */
export function htttShort(code) {
  return HTTT_SHORT_LABEL[code] || HTTT_LABEL_BY_VALUE[code] || '—';
}

// item.lhsc trong DB là LOẠI HẠNG MỤC ('DV' = công thợ, 'PT' = vật tư) - KHÁC
// với cột "LHSC" in trên phiếu (đó là repair_category ở trên). Tên cột trùng
// nhau là di sản, đừng lẫn: màn Quản lý / Tổng giám đốc đang hiển thị cột này.
export function itemTypeLabel(lhsc) {
  if (lhsc === 'PT') return 'Phụ tùng';
  if (lhsc === 'DV') return 'Dịch vụ';
  return '—';
}
