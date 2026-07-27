import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useRepairOrderEventsSSE } from '../../hooks/useRepairOrderEventsSSE';
import { ROLES } from '../../constants/roles';
import { formatCurrency } from '../../utils';
import { searchVehiclesApi } from '../../services/vehicleApi';
import { searchCatalogApi } from '../../services/catalogApi';
import { searchProductsApi } from '../../services/productApi';
import {
  listRepairSettlementsApi,
  getRepairSettlementApi,
  checkDuplicateSettlementApi,
  createRepairSettlementApi,
  updateRepairSettlementApi,
  updateRepairSettlementStatusApi,
  createPayosPaymentLinkApi,
} from '../../services/repairSettlementApi';
import { updateRepairOrderStatusApi } from '../../services/repairOrderApi';
import { MOCK_BRANCH, STATUS_LABELS } from './mockData';
import './RepairSettlementPage.css';

// item.lhsc ('DV'/'PT') la LOAI HANG MUC (dong nay la cong tho hay vat tu) -
// khong con chon tay qua dropdown nua (tu dong theo nut "Thêm dịch vụ"/"Thêm
// phụ tùng" hoac theo catalog da chon) - chi dung noi bo de: (1) quyet dinh
// pham vi tra cuu dich vu/goi combo hay kho phu tung, (2) nhom dong vao dung
// section "Công việc thực hiện" hay "Phụ tùng, vật tư" khi hien thi.
// LHSC thật - phân loại BẢN CHẤT công việc sửa chữa (không liên quan ai trả
// tiền, cái đó là HTTT) - dùng để in lên phiếu quyết toán và báo cáo doanh thu
// theo loại hình. Rút gọn còn 5 nhóm lớn theo hệ thống xe.
const REPAIR_CATEGORY_OPTIONS = [
  { value: 'ER', label: 'Sửa chữa động cơ' },
  { value: 'CB', label: 'Sửa chữa gầm - phanh' },
  { value: 'EE', label: 'Sửa chữa điện - điện tử' },
  { value: 'BP', label: 'Đồng sơn' },
  { value: 'PM', label: 'Bảo dưỡng định kỳ' },
];
const REPAIR_CATEGORY_LABEL_BY_VALUE = Object.fromEntries(REPAIR_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
// HTTT = nơi DUY NHẤT xác định ai trả tiền cho dòng này. "Hợp đồng bảo dưỡng"
// (gói trả trước, dùng nhiều lần) chưa có bảng theo dõi số dư nên tạm chưa đưa
// vào đây - tránh cho chọn 1 lựa chọn "miễn phí" mà không có gì kiểm chứng.
const HTTT_OPTIONS = [
  { value: 'KHT', label: 'Khách hàng thanh toán' },
  { value: 'BHH', label: 'Bảo hành hãng xe' },
  { value: 'BH', label: 'Bảo hiểm chi trả' },
  { value: 'NB', label: 'Nội bộ chịu phí' },
];
const HTTT_LABEL_BY_VALUE = Object.fromEntries(HTTT_OPTIONS.map((o) => [o.value, o.label]));
// ĐVT thường gặp cho gara ô tô (chỉ áp dụng cho dòng phụ tùng - dòng dịch vụ
// luôn cố định đơn vị "Công", không cho sửa).
const UNIT_OPTIONS = ['Cái', 'Bộ', 'Lít', 'Chai', 'Bình'];

// Còn bảo hành khi CẢ HAI điều kiện thỏa: còn trong thời hạn (warrantyEndDate)
// VÀ còn trong hạn km (warrantyKmLimit so với km hiện tại đang nhập cho lần vào
// xưởng này) - khớp logic BE (_checkWarranty trong RepairSettlementRepositoryImpl).
// Trả về lý do cụ thể (hết hạn theo thời gian và/hoặc vượt km) để hiển thị rõ
// ràng, tránh trường hợp xe vẫn còn hạn thời gian nhưng đã vượt km mà chỉ báo
// chung "hết bảo hành" khiến cố vấn không biết vì sao.
function getWarrantyStatus({ warrantyEndDate, warrantyKmLimit, currentKm }) {
  if (!warrantyEndDate || warrantyKmLimit == null) return null; // không có hồ sơ bảo hành
  const withinPeriod = new Date() <= new Date(warrantyEndDate);
  const km = Number(currentKm);
  const hasKmInput = !(currentKm === '' || currentKm == null || Number.isNaN(km));
  const withinKm = hasKmInput ? km <= warrantyKmLimit : true;

  if (withinPeriod && withinKm) {
    return { covered: true, label: 'Xe còn trong thời hạn bảo hành' };
  }
  if (!withinPeriod && !withinKm) {
    return { covered: false, label: 'Xe không còn được bảo hành (đã hết thời hạn và vượt số km quy định bảo hành)' };
  }
  if (!withinKm) {
    return { covered: false, label: 'Xe không còn được bảo hành (đã vượt số km quy định bảo hành)' };
  }
  return { covered: false, label: 'Xe không còn được bảo hành (đã hết thời hạn bảo hành)' };
}

const TABS = [
  { key: 'waiting_repair', label: 'Chờ sửa chữa' },
  { key: 'inprogress', label: 'Đang sửa chữa' },
  { key: 'waiting_payment', label: 'Chờ thanh toán' },
  { key: 'invoiced', label: 'Đã xuất hóa đơn' },
];
// Mau dong nhat cho tab dang duoc chon - de khi doi tab, tat ca deu chuyen
// sang cung 1 mau (cam) thay vi moi tab co mau active rieng.
const ACTIVE_TAB_COLOR = '#E65100';

// ─── Số tiền bằng chữ ────────────────────────────────────────────────
function numberToVietnamese(num) {
  if (!num || num === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const readGroup = (n) => {
    const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
    let s = '';
    if (h) s += units[h] + ' trăm ';
    if (t === 1) s += 'mười ';
    else if (t > 1) s += units[t] + ' mươi ';
    if (u === 1 && t > 1) s += 'mốt';
    else if (u === 5 && t > 0) s += 'lăm';
    else if (u) s += units[u];
    return s.trim();
  };
  const scales = ['', ' nghìn', ' triệu', ' tỷ'];
  const groups = [];
  let n = Math.floor(num);
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  let result = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]) result += (result ? ' ' : '') + readGroup(groups[i]) + scales[i];
  }
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn';
}

function emptyItem() {
  // httt de trong (chua chon) - chi mac dinh "Khach hang thanh toan" SAU KHI
  // co van chon 1 dich vu/goi/phu tung that tu catalog (xem selectCatalog*),
  // tranh hien thi san 1 gia tri nhu da chon roi trong khi dong con dang trong.
  return { code: '', serviceId: null, productId: null, description: '', lhsc: 'DV', httt: '', repairCategory: '', unit: 'Công', qty: 1, unitPrice: 0, discount: 0, total: 0 };
}

// Suy luan lai nhom "dich vu/goi da chon + phu tung/dich vu con tu dong chen
// kem theo" tu du lieu da luu (BE khong luu quan he cha-con, groupId chi ton
// tai o FE). Dau nhom la 1 dich vu le that (co serviceId, don gia > 0) hoac 1
// dong goi combo (khong co serviceId). Cac dong ngay sau no la PT hoac DV gia
// 0 (dich vu con cua goi) deu la "con" cua dau nhom gan nhat, cho den khi gap
// dau nhom tiep theo - dung de khi Xoa/chon lai dau nhom thi don dep dung cac
// dong con di kem, khong de sot lai orphan.
function assignGroupIds(items, nextGroupId) {
  let currentGroupId = null;
  return items.map((it) => {
    const isHead = it.lhsc === 'DV' && (!it.serviceId || (it.unitPrice || 0) > 0);
    if (isHead) {
      currentGroupId = nextGroupId();
      return { ...it, groupId: currentGroupId, isGroupParent: true };
    }
    const isChild = currentGroupId && (it.lhsc === 'PT' || (it.lhsc === 'DV' && (it.unitPrice || 0) === 0));
    if (isChild) {
      return { ...it, groupId: currentGroupId };
    }
    currentGroupId = null;
    return it;
  });
}

// Mau nen nhat (pastel) rieng cho tung nhom (gói/dịch vụ + phụ tùng phụ thuộc
// đi kèm) trên bảng "Hạng mục công việc / phụ tùng" của MÀN TẠO/SỬA QUYẾT
// TOÁN - CHỈ để cố vấn dễ phân biệt nhóm nào với nhóm nào trên màn hình, cyclic
// theo groupId. KHÔNG áp dụng khi in phiếu (printSettlement/SettlementPreviewModal
// không dùng hàm này). Dòng không thuộc nhóm nào (gói đơn/phụ tùng thêm gõ tay,
// không groupId) dùng 1 mau trung tinh rieng, khac voi mau cua bat ky nhom nao.
const GROUP_ROW_COLORS = [
  '#EEF4FF', // xanh duong nhat
  '#F1FBEA', // xanh la nhat
  '#FFF7E6', // vang nhat
  '#FDEEF6', // hong nhat
  '#F1EEFE', // tim nhat
  '#E9FBF7', // xanh ngoc nhat
];
const UNGROUPED_ROW_COLOR = '#FAFAFA';

function rowColorForGroup(groupId) {
  if (!groupId) return UNGROUPED_ROW_COLOR;
  return GROUP_ROW_COLORS[groupId % GROUP_ROW_COLORS.length];
}

// Che dữ liệu nhạy cảm (điện thoại, email, CCCD) khi hiển thị dữ liệu đã tra cứu
// từ DB — chỉ hiện 4 ký tự cuối, phần còn lại thay bằng dấu *.
function maskLast4(value) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= 4) return '*'.repeat(str.length);
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

// QR thanh toan PayOS (that, gan voi tai khoan ngan hang da lien ket) - dung
// chung 1 dich vu ve QR-image cho ca modal xem truoc lan ban in, dung du lieu
// PayOS tra ve (qrCode). Khong con QR tinh/demo nua - phieu nao khong co
// qrCode (chua den buoc cho thanh toan, hoac da xuat hoa don roi) thi khong
// hien QR gi ca, tranh nham lan voi tai khoan gia truoc day.
function buildPayosQrImageUrl(qrCode) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`;
}

// "total" = so tien THUC SU thu cua khach hang cho dong nay - dong mien phi
// (isFree) hoac mien thu khach (bao hanh/bao hiem/noi bo chiu phi) deu la 0,
// du don gia/so luong that su la bao nhieu (van giu nguyen unitPrice/qty/
// discount rieng de con doi lai duoc neu sau nay doi HTTT). Nho vay cot
// "Thanh tien" hien dung so tien khach phai tra cho tung dong, khong can doc
// them dong tong ket rieng moi biet dong nao duoc mien.
function recalcItem(item) {
  const base = (item.qty || 0) * (item.unitPrice || 0);
  const disc = base * ((item.discount || 0) / 100);
  const rawTotal = Math.round(base - disc);
  return { ...item, total: (item.isFree || isExemptFromCustomerBilling(item)) ? 0 : rawTotal };
}

// Hạng mục có HTTT = Bảo hành hãng xe / Bảo hiểm chi trả / Nội bộ chịu phí ->
// khách không phải trả (hãng xe/bảo hiểm/gara tự xử lý ngoài hệ thống), nên
// loại khỏi số tiền thu khách.
function isExemptFromCustomerBilling(item) {
  return item.httt === 'BHH' || item.httt === 'BH' || item.httt === 'NB';
}

// Nhan ngan gon hien ben canh so 0 o cot "Thanh tien" cho dong duoc mien thu
// khach (vd "0 (Bảo hành)") - de co van biet ngay VI SAO dong nay la 0 ma
// khong can doi chieu qua cot HTTT.
const EXEMPTION_SHORT_LABEL = { BHH: 'Bảo hành', BH: 'Bảo hiểm', NB: 'Nội bộ' };
function exemptionShortLabel(item) {
  return EXEMPTION_SHORT_LABEL[item.httt] || null;
}

function calcTotals(items) {
  const billable = (i) => !i.isFree && !isExemptFromCustomerBilling(i);
  const subtotal = items.reduce((s, i) => s + (billable(i) ? (i.qty || 0) * (i.unitPrice || 0) * (1 - (i.discount || 0) / 100) : 0), 0);
  const discountAmount = items.reduce((s, i) => s + (billable(i) ? (i.qty || 0) * (i.unitPrice || 0) * ((i.discount || 0) / 100) : 0), 0);
  const vat = Math.round(subtotal * 0.08);
  const freeAmount = items.filter((i) => i.isFree).reduce((s, i) => s + (i.qty || 0) * (i.unitPrice || 0), 0);
  const exemptedAmount = items
    .filter((i) => !i.isFree && isExemptFromCustomerBilling(i))
    .reduce((s, i) => s + (i.qty || 0) * (i.unitPrice || 0) * (1 - (i.discount || 0) / 100), 0);
  return {
    subtotal: Math.round(subtotal),
    discountAmount: Math.round(discountAmount),
    afterDiscount: Math.round(subtotal),
    vat,
    freeAmount: Math.round(freeAmount),
    exemptedAmount: Math.round(exemptedAmount),
    total: Math.round(subtotal) + vat,
  };
}

// ─── In danh sách công việc (cho KTV) ────────────────────────────────
// Export de dung chung o man Lenh sua chua (RepairOrderPage) - in danh sach
// cong viec cho to truong sau khi phan cong xong, cung 1 mau in nhu o day.
export function printWorkList(order) {
  const rows = (order.items || []).map((item, i) => `
    <tr>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;font-family:monospace;font-size:10px">${item.code || ''}</td>
      <td style="border:1px solid #ccc;padding:4px 7px">${item.description}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:center">${item.lhsc}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:center">${item.unit}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:center">${item.qty}</td>
      <td style="border:1px solid #ccc;padding:4px 7px"></td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<title>Danh sách công việc ${order.code}</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;margin:10mm 15mm}table{width:100%;border-collapse:collapse}th{background:#f0f0f0;border:1px solid #ccc;padding:5px 7px;text-align:center}.sign-row{display:flex;justify-content:space-between;margin-top:35px}.sign-box{text-align:center;width:45%}.sign-line{margin-top:45px;border-top:1px solid #000;padding-top:3px;font-size:10px}</style>
</head><body>
<div style="text-align:center;margin-bottom:8px">
  <b style="font-size:13px">DANH SÁCH CÔNG VIỆC KỸ THUẬT</b><br/>
  <span style="font-size:11px">Số RO: <b>${order.code}</b> &nbsp;|&nbsp; Ngày: <b>${order.date || new Date().toLocaleDateString('vi-VN')}</b></span>
</div>
<table style="border:none;margin-bottom:8px">
  <tr>
    <td style="border:none;width:50%;padding:1px 0"><b>Khách hàng:</b> ${order.customer?.fullName || ''}</td>
    <td style="border:none;padding:1px 0"><b>Biển số xe:</b> ${order.vehicle?.licensePlate || ''} – ${order.vehicle?.vehicleModel || ''}</td>
  </tr>
  <tr>
    <td style="border:none;padding:1px 0"><b>Tổ trưởng:</b> ${order.teamLeader || '—'}</td>
    <td style="border:none;padding:1px 0"><b>Số Km:</b> ${(order.vehicle?.currentKm || 0).toLocaleString()}</td>
  </tr>
</table>
<table>
  <thead><tr><th style="width:28px">STT</th><th style="width:80px">Mã số</th><th>Nội dung công việc</th><th style="width:55px">Loại</th><th style="width:55px">ĐVT</th><th style="width:40px">SL</th><th style="width:160px">Ký xác nhận</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p style="font-size:10px;font-style:italic;margin-top:6px">KTV ký xác nhận từng hạng mục sau khi hoàn thành.</p>
<div class="sign-row">
  <div class="sign-box"><b>CỐ VẤN DỊCH VỤ</b><div class="sign-line">Ký tên</div></div>
  <div class="sign-box"><b>KỸ THUẬT VIÊN</b><div class="sign-line">Ký và ghi rõ họ tên</div></div>
</div>
</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.print();
}

// ─── In phiếu quyết toán sửa chữa ────────────────────────────────────
// payosQrCode: chuoi QR PayOS dang con hieu luc (chi co khi in tu modal xem
// truoc luc phieu dang "cho thanh toan") - khong truyen thi khong hien QR
// gi ca (vd in luc vua tao phieu, hoac in lai phieu da xuat hoa don roi).
function printSettlement(order, payosQrCode) {
  // Tach 2 nhom "Cong viec can thuc hien" / "Phu tung, vat tu" khi in - giong
  // cach hien thi ben form tao/sua phieu va modal Xem chi tiet (giu nguyen so
  // thu tu goc trong mang items, khong danh lai tu 1 cho tung nhom).
  const indexedItems = (order.items || []).map((item, i) => ({ item, i }));
  const laborItems = indexedItems.filter(({ item }) => item.lhsc !== 'PT');
  const partItems = indexedItems.filter(({ item }) => item.lhsc === 'PT');
  const laborSubtotal = laborItems.reduce((s, { item }) => s + (item.total || 0), 0);
  const partSubtotal = partItems.reduce((s, { item }) => s + (item.total || 0), 0);

  const renderItemRow = ({ item, i }) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center">${item.code}</td>
      <td>${item.description}</td>
      <td style="text-align:center">${item.repairCategory || ''}</td>
      <td style="text-align:center">${item.httt}</td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right">${(item.unitPrice || 0).toLocaleString('vi-VN')}</td>
      <td style="text-align:center">${item.discount || 0}%</td>
      <td style="text-align:center">${item.isFree ? 'Có' : ''}</td>
      <td style="text-align:right"><b>${(item.total || 0).toLocaleString('vi-VN')}${exemptionShortLabel(item) ? ` (${exemptionShortLabel(item)})` : ''}</b></td>
    </tr>`;

  const groupHeaderRow = (label) => `
    <tr>
      <td colspan="2" style="background:#e2e8f0;border-right:none"></td>
      <td colspan="9" style="background:#e2e8f0;font-weight:bold;padding:5px 7px;border-left:none">${label}</td>
    </tr>`;

  const groupSubtotalRow = (amount) => `
    <tr>
      <td colspan="10" style="text-align:right;font-weight:bold">Cộng</td>
      <td style="text-align:right;font-weight:bold">${amount.toLocaleString('vi-VN')}</td>
    </tr>`;

  let itemsHtml = groupHeaderRow('CÔNG VIỆC CẦN THỰC HIỆN')
    + laborItems.map(renderItemRow).join('')
    + groupSubtotalRow(laborSubtotal);
  if (partItems.length > 0) {
    itemsHtml += groupHeaderRow('PHỤ TÙNG, VẬT TƯ')
      + partItems.map(renderItemRow).join('')
      + groupSubtotalRow(partSubtotal);
  }

  const qrBlockHtml = payosQrCode
    ? `<div style="text-align:center;flex-shrink:0">
    <img src="${buildPayosQrImageUrl(payosQrCode)}" style="width:90px;height:90px;border:1px solid #ddd" />
    <div style="font-size:9px;color:#888">Quét app ngân hàng để thanh toán</div>
  </div>`
    : '';

  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<title>Quyết toán sửa chữa ${order.code}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 10mm 15mm; color:#000; }
  .center { text-align:center; } .bold { font-weight:bold; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #333; padding:3px 5px; font-size:11px; }
  th { background:#f0f0f0; font-weight:bold; text-align:center; }
  .info-table td { border:1px solid #555; padding:3px 6px; }
  .totals td { border:none; padding:2px 6px; }
  .totals .lbl { text-align:right; font-weight:600; }
  .totals .val { text-align:right; font-weight:700; min-width:90px; }
  .sign-row { display:flex; justify-content:space-between; margin-top:30px; }
  .sign-box { text-align:center; width:22%; }
  .sign-line { margin-top:40px; border-top:1px solid #000; padding-top:3px; font-size:10px; }
  @media print { body { margin:8mm 12mm; } }
</style></head><body>
<div class="center bold" style="font-size:12px">CÔNG TY TNHH AUTOGARA – CHI NHÁNH ${(order.branch || MOCK_BRANCH).toUpperCase()}</div>
<div class="center bold" style="font-size:16px; margin:6px 0">QUYẾT TOÁN SỬA CHỮA</div>
<div style="display:flex; justify-content:space-between; margin-bottom:6px">
  <div><b>Số RO:</b> ${order.code}</div>
  <div><b>Ngày:</b> ${order.date}</div>
  <div><b>Tư vấn dịch vụ:</b> ${order.advisor} (${order.advisorPhone || ''})</div>
</div>

<table class="info-table" style="margin-bottom:8px">
  <tr>
    <td width="30%"><b>Tên khách hàng:</b> ${order.customer?.fullName}</td>
    <td width="20%"><b>Biển số xe:</b> ${order.vehicle?.licensePlate}</td>
    <td width="30%"><b>Loại xe:</b> ${order.vehicle?.vehicleModel}</td>
  </tr>
  <tr>
    <td><b>Địa chỉ:</b> ${order.customer?.address}</td>
    <td><b>Số khung:</b> ${order.vehicle?.frameNumber}</td>
    <td><b>Số máy:</b> ${order.vehicle?.engineNumber}</td>
  </tr>
  <tr>
    <td><b>Điện thoại:</b> ${maskLast4(order.customer?.phone)} &nbsp; <b>MST:</b> ${order.customer?.taxCode || '—'}</td>
    <td><b>Ngày mua:</b> ${order.vehicle?.purchaseDate || '—'}</td>
    <td><b>Số Km:</b> ${(order.vehicle?.currentKm || 0).toLocaleString()}</td>
  </tr>
  <tr>
    <td><b>CCCD:</b>&nbsp;</td>
    <td colspan="2"><b>Email:</b>&nbsp;</td>
  </tr>
  <tr>
    <td colspan="3"><b>Yêu cầu KH:</b> ${order.customerRequest || ''}</td>
  </tr>
</table>

<table>
  <thead>
    <tr>
      <th>STT</th><th>Mã số</th><th>Nội dung công việc</th>
      <th>LHSC</th><th>HTTT</th><th>ĐVT</th><th>SL</th>
      <th>Đơn giá (chưa VAT)</th><th>Giảm giá (%)</th><th>Miễn phí</th><th>Thành tiền</th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>

<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-top:6px">
  <div style="flex:1;font-size:10px;border-top:1px solid #ccc;padding-top:4px">
    Phụ tùng thay thế tại trung tâm Dịch vụ ủy quyền AutoGara được bảo hành 06 tháng hoặc 10.000km tùy theo điều kiện nào đến trước.
    <br>Phiếu này chỉ có giá trị xuất hóa đơn trong ngày.
  </div>
  ${qrBlockHtml}
  <table class="totals" style="width:280px;flex-shrink:0;margin:0">
    <tr><td class="lbl">Tổng cộng trước giảm giá:</td><td class="val">${(order.subtotal || 0).toLocaleString('vi-VN')}</td></tr>
    <tr><td class="lbl">Tổng cộng giảm giá:</td><td class="val">${(order.discountAmount || 0).toLocaleString('vi-VN')}</td></tr>
    <tr><td class="lbl">Tổng cộng sau giảm giá:</td><td class="val">${(order.afterDiscount || 0).toLocaleString('vi-VN')}</td></tr>
    <tr><td class="lbl">Tiền thuế GTGT (8%):</td><td class="val">${(order.vat || 0).toLocaleString('vi-VN')}</td></tr>
    <tr><td class="lbl">Miễn phí:</td><td class="val">${(order.freeAmount || 0).toLocaleString('vi-VN')}</td></tr>
    <tr style="font-size:13px"><td class="lbl"><b>Tổng giá trị thanh toán:</b></td><td class="val" style="color:#C62828"><b>${(order.total || 0).toLocaleString('vi-VN')}</b></td></tr>
    <tr><td colspan="2" style="font-size:10px; font-style:italic; text-align:right">Bằng chữ: ${numberToVietnamese(order.total)}</td></tr>
  </table>
</div>

<div class="sign-row">
  <div class="sign-box"><div class="bold">Khách hàng</div><div class="sign-line">${order.customer?.fullName || ''}</div></div>
  <div class="sign-box"><div class="bold">Tư vấn dịch vụ</div><div class="sign-line">${order.advisor || ''}</div></div>
  <div class="sign-box"><div class="bold">Kế toán dịch vụ</div><div class="sign-line"></div></div>
  <div class="sign-box"><div class="bold">QĐ/TP/PP DVPT</div><div class="sign-line"></div></div>
</div>
</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  // Anh QR tai qua network (img.vietqr.io) - phai doi load xong roi moi in,
  // goi print() ngay sau document.close() se in truoc khi anh kip hien.
  w.onload = () => w.print();
}

// ─── In phiếu xe ra ("Giấy xe khách ra cổng") ─────────────────────────
// Mau in khi giao xe lai cho khach o phieu DA XUAT HOA DON - thay cho nut
// "Xem/In lại" (von chi mo lai phieu quyet toan, khong lien quan den buoc
// giao xe). Bo cuc tham khao mau giay ra cong thuc te cua dai ly xe hoi, dung
// logo/ten AutoGara thay logo hang xe, va "Cố vấn dịch vụ" thay "Tư vấn dịch
// vụ" cho dung thuat ngu he thong nay dang dung.
function printVehicleOutSlip(order) {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<title>Giấy xe ra cổng ${order.code}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 10mm 15mm; color:#000; }
  .center { text-align:center; } .bold { font-weight:bold; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px; }
  .header-left { display:flex; gap:10px; align-items:center; }
  .header-left img { width:52px; height:52px; object-fit:contain; }
  .header-left .company { font-size:11px; line-height:1.5; }
  .header-right { text-align:right; font-size:11px; line-height:1.8; }
  .title { font-size:18px; font-weight:800; letter-spacing:1px; margin:10px 0 2px; }
  .subtitle { font-size:12px; color:#333; margin-bottom:14px; }
  .field-row { display:flex; gap:30px; margin-bottom:14px; font-size:13px; }
  .field-row span.lbl { font-weight:bold; }
  .field-row span.val { border-bottom:1px solid #000; padding:0 6px; min-width:160px; display:inline-block; }
  .checklist { border:1px solid #333; border-radius:4px; padding:12px 16px; margin-bottom:14px; }
  .checklist-row { display:flex; align-items:center; gap:8px; padding:4px 0; font-size:12.5px; }
  .checkbox { width:14px; height:14px; border:1.5px solid #000; flex-shrink:0; display:inline-block; }
  .total-row { display:flex; justify-content:space-between; align-items:center; border:1px solid #333; border-radius:4px; padding:10px 16px; margin-bottom:16px; font-size:14px; }
  .total-row b { color:#C62828; font-size:16px; }
  .confirm-note { font-size:11.5px; font-style:italic; border-top:1px solid #ccc; padding-top:6px; margin-bottom:26px; }
  .sign-row { display:flex; justify-content:space-between; }
  .sign-box { text-align:center; width:19%; }
  .sign-line { margin-top:44px; border-top:1px solid #000; padding-top:3px; font-size:10px; }
  @media print { body { margin:8mm 12mm; } }
</style></head><body>

<div class="header">
  <div class="header-left">
    <img src="/AutoGaraLogo-Photoroom.png" alt="AutoGara" />
    <div class="company">
      <b>CÔNG TY TNHH AUTOGARA</b><br>
      Chi nhánh: ${order.branch || MOCK_BRANCH}<br>
      Cố vấn dịch vụ: ${order.advisor || ''}
    </div>
  </div>
  <div class="header-right">
    <div><b>RO:</b> ${order.code}</div>
    <div><b>Ngày vào xưởng:</b> ${order.date || ''}</div>
    <div><b>Ngày xe ra:</b> ${order.paidDate || todayStr}</div>
  </div>
</div>

<div class="center title">GIẤY XE KHÁCH RA CỔNG</div>
<div class="center subtitle">Bộ phận dịch vụ sau bán hàng</div>

<div class="field-row">
  <div><span class="lbl">Biển số xe:</span> <span class="val">${order.vehicle?.licensePlate || ''}</span></div>
  <div><span class="lbl">Loại xe:</span> <span class="val">${order.vehicle?.vehicleModel || ''}</span></div>
</div>

<div class="checklist">
  <div class="checklist-row"><span class="checkbox"></span>(1) Kiểm tra sửa chữa miễn phí</div>
  <div class="checklist-row"><span class="checkbox"></span>(2) Sửa chữa bảo hành</div>
  <div class="checklist-row"><span class="checkbox"></span>(3) Bán lẻ phụ tùng</div>
  <div class="checklist-row"><span class="checkbox"></span>(4) Tạm xuất xưởng, vận tải</div>
  <div class="checklist-row"><span class="checkbox"></span>(5) Giao xe Showroom, vận tải</div>
  <div class="checklist-row"><span class="checkbox"></span>(6) Khách hàng thanh toán</div>
  <div class="checklist-row"><span class="checkbox"></span>(7) Bảo hiểm thanh toán</div>
  <div class="checklist-row"><span class="checkbox"></span>(8) Mục đích khác, ghi rõ lý do: …………………………………………</div>
</div>

<div class="total-row">
  <span>Tổng giá trị thanh toán:</span>
  <b>${(order.total || 0).toLocaleString('vi-VN')} VNĐ</b>
</div>

<div class="confirm-note">
  Xe đã hoàn tất thủ tục và được giao lại đúng cho khách hàng hoặc đại diện khách hàng.<br>
  Ghi chú: .....................................................................................................................
</div>

<div class="sign-row">
  <div class="sign-box"><div class="bold">Khách hàng</div><div class="sign-line">${order.customer?.fullName || ''}</div></div>
  <div class="sign-box"><div class="bold">Cố vấn dịch vụ</div><div class="sign-line">${order.advisor || ''}</div></div>
  <div class="sign-box"><div class="bold">Kế toán</div><div class="sign-line"></div></div>
  <div class="sign-box"><div class="bold">GĐ/TP Dịch vụ</div><div class="sign-line"></div></div>
  <div class="sign-box"><div class="bold">Bảo vệ</div><div class="sign-line"></div></div>
</div>
</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

// ─── Modal xem trước & xuất phiếu quyết toán ────────────────────────
function SettlementPreviewModal({ order, onClose }) {
  // Chi con dung de doi chu nut in ("In phieu" vs "In lai phieu") - khong con
  // nut "Xac nhan xuat hoa don" thu cong nua, PayOS webhook tu dong chuyen
  // trang thai "invoiced" khi thanh toan thanh cong (xem handlePayosWebhook).
  const [hasPrinted, setHasPrinted] = useState(false);

  // PayOS: QR dong that, tu tao ngay khi mo modal cho phieu dang cho thanh
  // toan (khong doi CVDV bam them nut nao) - het han sau 60s, khach quet la
  // ra dung so tien can chuyen. Khi PayOS bao da nhan tien (webhook), phieu
  // tu dong chuyen "Da xuat hoa don" qua SSE 'invoiced' (xem handleRepairOrderEvent
  // ben duoi) - khong lien quan gi den hasPrinted/xac nhan tay o tren.
  const [payos, setPayos] = useState(null); // { qrCode, checkoutUrl, orderCode, expiredAt }
  const [payosLoading, setPayosLoading] = useState(false);
  const [payosError, setPayosError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const requestPayosQr = async () => {
    setPayosLoading(true);
    setPayosError('');
    try {
      const result = await createPayosPaymentLinkApi(order.id);
      setPayos(result);
    } catch (err) {
      setPayosError(err.message || 'Không tạo được mã QR thanh toán');
    } finally {
      setPayosLoading(false);
    }
  };

  useEffect(() => {
    if (order.status === 'waiting_payment') {
      requestPayosQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  useEffect(() => {
    if (!payos) return undefined;
    const tick = () => setSecondsLeft(Math.max(0, payos.expiredAt - Math.floor(Date.now() / 1000)));
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [payos]);

  const handlePrint = () => {
    printSettlement(order, payos?.qrCode);
    setHasPrinted(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <h3 className="modal-title">Quyết toán sửa chữa — {order.code}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ background: 'white', border: '1px solid #DDD', borderRadius: 8, padding: '18px 20px', fontFamily: 'Arial, sans-serif', fontSize: 12 }}>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                CÔNG TY TNHH AUTOGARA – CHI NHÁNH {(order.branch || MOCK_BRANCH).toUpperCase()}
              </div>
              <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 1, margin: '4px 0' }}>QUYẾT TOÁN SỬA CHỮA</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, flexWrap: 'wrap', gap: 6 }}>
              <span><b>Số RO:</b> {order.code}</span>
              <span><b>Ngày:</b> {order.date}</span>
              <span><b>Tư vấn dịch vụ:</b> {order.advisor}</span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <tbody>
                <tr>
                  <td className="detail-cell"><b>Tên khách hàng:</b> {order.customer?.fullName}</td>
                  <td className="detail-cell"><b>Biển số xe:</b> {order.vehicle?.licensePlate}</td>
                  <td className="detail-cell"><b>Loại xe:</b> {order.vehicle?.vehicleModel}</td>
                </tr>
                <tr>
                  <td className="detail-cell"><b>Địa chỉ:</b> {order.customer?.address || '—'}</td>
                  <td className="detail-cell"><b>Số khung:</b> {order.vehicle?.frameNumber || '—'}</td>
                  <td className="detail-cell"><b>Số máy:</b> {order.vehicle?.engineNumber || '—'}</td>
                </tr>
                <tr>
                  <td className="detail-cell"><b>Điện thoại:</b> {order.customer?.phone}</td>
                  <td className="detail-cell"><b>MST:</b> {order.customer?.taxCode || '—'}</td>
                  <td className="detail-cell"><b>Số Km:</b> {(order.vehicle?.currentKm || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
              <thead>
                <tr>
                  <th className="th-cell" style={{ width: 28 }}>STT</th>
                  <th className="th-cell" style={{ width: 60 }}>Mã số</th>
                  <th className="th-cell">Nội dung công việc</th>
                  <th className="th-cell" style={{ width: 42 }}>LHSC</th>
                  <th className="th-cell" style={{ width: 42 }}>ĐVT</th>
                  <th className="th-cell" style={{ width: 28 }}>SL</th>
                  <th className="th-cell" style={{ width: 95 }}>Đơn giá</th>
                  <th className="th-cell" style={{ width: 88 }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((s, i) => (
                  <tr key={i}>
                    <td className="td-cell" style={{ textAlign: 'center', color: '#666' }}>{i + 1}</td>
                    <td className="td-cell" style={{ textAlign: 'center', fontSize: 10, color: '#888' }}>{s.code || ''}</td>
                    <td className="td-cell">
                      {s.description}
                      {s.isFree && <span className="tag" style={{ marginLeft: 6 }}>Miễn phí</span>}
                      {!s.isFree && isExemptFromCustomerBilling(s) && <span className="tag" style={{ marginLeft: 6 }}>Miễn thu KH</span>}
                    </td>
                    <td className="td-cell" style={{ textAlign: 'center' }}>{REPAIR_CATEGORY_LABEL_BY_VALUE[s.repairCategory] || '—'}</td>
                    <td className="td-cell" style={{ textAlign: 'center' }}>{s.unit}</td>
                    <td className="td-cell" style={{ textAlign: 'center' }}>{s.qty}</td>
                    <td className="td-cell" style={{ textAlign: 'right' }}>{(s.unitPrice || 0).toLocaleString('vi-VN')}</td>
                    <td className="td-cell" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {(s.total || 0).toLocaleString('vi-VN')}
                      {exemptionShortLabel(s) && <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}> ({exemptionShortLabel(s)})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginTop: 10 }}>
              <div style={{ flex: 1, fontSize: 11 }}>
                <b>Bằng chữ:</b> <i>{numberToVietnamese(order.total)}</i>
                <div style={{ fontSize: 10, color: '#444', marginTop: 4, lineHeight: 1.6 }}>
                  <i>Phiếu này chỉ có giá trị xuất hóa đơn trong ngày.</i>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {order.status === 'waiting_payment' ? (
                  <>
                    {payos && secondsLeft > 0 ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(payos.qrCode)}`}
                        alt="QR thanh toán PayOS"
                        style={{ width: 130, height: 130, border: '1px solid #DDD' }}
                      />
                    ) : (
                      <div style={{
                        width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px dashed #ccc', textAlign: 'center', fontSize: 11, color: '#888', padding: 6,
                      }}>
                        {payosLoading ? 'Đang tạo mã QR…' : payos ? 'Mã QR đã hết hạn' : (payosError || 'Chưa có mã QR')}
                      </div>
                    )}
                    {payos && secondsLeft > 0 ? (
                      <div style={{ fontSize: 9, color: '#888' }}>Quét app ngân hàng — hết hạn sau {secondsLeft}s</div>
                    ) : (
                      !payosLoading && (
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '4px 8px' }} onClick={requestPayosQr}>
                          Tạo lại mã QR
                        </button>
                      )
                    )}
                  </>
                ) : (
                  <div style={{
                    width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #A5D6A7', borderRadius: 8, background: '#E8F5E9',
                    textAlign: 'center', fontSize: 12, color: '#2E7D32', fontWeight: 600, padding: 6,
                  }}>
                    ✓ Đã thanh toán
                  </div>
                )}
              </div>
              <div style={{ minWidth: 260, flexShrink: 0 }}>
                {[
                  ['Tổng cộng trước giảm giá:', order.subtotal],
                  ['Tổng cộng giảm giá:', order.discountAmount],
                  ['Tiền thuế GTGT (8%):', order.vat],
                  ['Miễn phí:', order.freeAmount],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', borderBottom: '1px solid #EEE' }}>
                    <span>{l}</span><b>{(v || 0).toLocaleString('vi-VN')}</b>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderTop: '2px solid #000', marginTop: 1 }}>
                  <b>Tổng giá trị thanh toán:</b>
                  <b style={{ color: 'red', fontSize: 14 }}>{(order.total || 0).toLocaleString('vi-VN')}</b>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
          <button className="btn btn-secondary" onClick={handlePrint}>
            {hasPrinted ? 'In lại phiếu quyết toán' : 'In phiếu quyết toán'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal xem chi tiết phiếu ────────────────────────────────────────
function DetailModal({ order, onClose, onPreview }) {
  const st = STATUS_LABELS[order.status];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h3 className="modal-title">Quyết toán sửa chữa – {order.code}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`badge ${st?.badge}`}>{st?.label}</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="responsive-2col" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
            <div>
              <div className="form-section-title">Thông tin khách hàng</div>
              {[
                ['Họ tên', order.customer?.fullName],
                ['Địa chỉ', order.customer?.address],
                ['Điện thoại', order.customer?.phone],
                ['CCCD', order.customer?.cccd || '—'],
                ['Email', order.customer?.email || '—'],
              ].map(([l, v]) => (
                <div key={l} className="detail-row">
                  <div className="detail-label" style={{ width: 130, fontSize: 11 }}>{l}</div>
                  <div className="detail-value" style={{ fontSize: 12 }}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="form-section-title">Thông tin xe</div>
              {[
                ['Biển số xe', order.vehicle?.licensePlate],
                ['Loại xe', order.vehicle?.vehicleModel],
                ['Số khung', order.vehicle?.frameNumber],
                ['Số máy', order.vehicle?.engineNumber],
                ['Số Km', `${(order.vehicle?.currentKm || 0).toLocaleString()} km`],
                ['Tổ trưởng', order.teamLeader || 'Chưa gán'],
              ].map(([l, v]) => (
                <div key={l} className="detail-row">
                  <div className="detail-label" style={{ width: 130, fontSize: 11 }}>{l}</div>
                  <div className="detail-value" style={{ fontSize: 12 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-section-title">Yêu cầu khách hàng</div>
          <div style={{ background: 'var(--gray-100)', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 16 }}>
            {order.customerRequest}
          </div>

          <div className="form-section-title">Hạng mục công việc</div>
          <div className="table-wrapper" style={{ marginBottom: 0 }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr><th>#</th><th>Mã</th><th>Nội dung công việc</th><th>LHSC</th><th>HTTT</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>CK%</th><th>Thành tiền</th></tr>
              </thead>
              <tbody>
                {(() => {
                  const indexed = (order.items || []).map((item, i) => ({ item, i }));
                  const laborRows = indexed.filter(({ item }) => item.lhsc !== 'PT');
                  const partRows = indexed.filter(({ item }) => item.lhsc === 'PT');
                  const laborSubtotal = laborRows.reduce((s, { item }) => s + (item.total || 0), 0);
                  const partSubtotal = partRows.reduce((s, { item }) => s + (item.total || 0), 0);

                  const renderRow = ({ item, i }) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'center' }}>{i + 1}</td>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.code}</span></td>
                      <td>
                        {item.description}
                        {!item.isFree && isExemptFromCustomerBilling(item) && <span className="tag" style={{ marginLeft: 6 }}>Miễn thu KH</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}><span className="tag">{REPAIR_CATEGORY_LABEL_BY_VALUE[item.repairCategory] || '—'}</span></td>
                      <td style={{ textAlign: 'center' }}>{HTTT_LABEL_BY_VALUE[item.httt] || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{item.unit}</td>
                      <td style={{ textAlign: 'center' }}>{item.qty}</td>
                      <td style={{ textAlign: 'right' }}>{(item.unitPrice || 0).toLocaleString('vi-VN')}</td>
                      <td style={{ textAlign: 'center' }}>{item.discount || 0}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {(item.total || 0).toLocaleString('vi-VN')}
                        {exemptionShortLabel(item) && <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}> ({exemptionShortLabel(item)})</span>}
                      </td>
                    </tr>
                  );

                  return (
                    <>
                      <tr>
                        <td colSpan={2} style={{ background: 'var(--gray-200)' }}></td>
                        <td colSpan={8} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>CÔNG VIỆC CẦN THỰC HIỆN</td>
                      </tr>
                      {laborRows.map(renderRow)}
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                        <td style={{ fontWeight: 700, textAlign: 'right' }}>{laborSubtotal.toLocaleString('vi-VN')}</td>
                      </tr>

                      {partRows.length > 0 && (
                        <>
                          <tr>
                            <td colSpan={2} style={{ background: 'var(--gray-200)' }}></td>
                            <td colSpan={8} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>PHỤ TÙNG, VẬT TƯ</td>
                          </tr>
                          {partRows.map(renderRow)}
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                            <td style={{ fontWeight: 700, textAlign: 'right' }}>{partSubtotal.toLocaleString('vi-VN')}</td>
                          </tr>
                        </>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {(() => {
            const serviceTasks = (order.tasks || []).filter((t) => t.taskType === 'service');
            if (serviceTasks.length === 0) return null;
            const doneCount = serviceTasks.filter((t) => t.isDone).length;
            return (
              <div style={{ marginTop: 16 }}>
                <div className="form-section-title">
                  Tiến độ công việc (Tổ trưởng) ({doneCount}/{serviceTasks.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {serviceTasks.map((t) => (
                    <label
                      key={t.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        background: t.isDone ? '#E8F5E9' : 'var(--gray-50)', borderRadius: 6,
                        fontSize: 13, textDecoration: t.isDone ? 'line-through' : 'none',
                        color: t.isDone ? '#2E7D32' : 'var(--gray-900)',
                      }}
                    >
                      <input type="checkbox" checked={t.isDone} disabled readOnly />
                      <span>{t.taskName}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div className="summary-box" style={{ minWidth: 300 }}>
              {[
                ['Tổng trước giảm giá', order.subtotal],
                ['Tổng giảm giá', order.discountAmount],
                ['Thuế GTGT (8%)', order.vat],
                ['Miễn phí', order.freeAmount],
              ].map(([l, v]) => (
                <div key={l} className="summary-row"><span>{l}:</span><span>{(v || 0).toLocaleString('vi-VN')} đ</span></div>
              ))}
              <div className="summary-row total"><span>Tổng thanh toán:</span><span>{formatCurrency(order.total)}</span></div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
          {order.status === 'inprogress' && (
            <button className="btn btn-secondary" onClick={() => { onClose(); printWorkList(order); }}>In danh sách công việc</button>
          )}
          {(order.status === 'waiting_payment' || order.status === 'invoiced') && (
            <button className="btn btn-primary" style={{ background: '#2E7D32', borderColor: '#2E7D32' }}
              onClick={() => { onClose(); onPreview(order); }}>
              Xem / In phiếu quyết toán
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Danh sách phiếu quyết toán sửa chữa ─────────────────────────────
function RepairSettlementList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canManage = user?.primaryRole !== ROLES.ADMIN;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Sau khi phan cong to truong xong (RepairOrderCreate) hoac tu cac luong
  // dieu huong khac muon mo san 1 tab cu the, co the truyen state: { tab }
  // khi navigate() toi day - vd chuyen thang sang "Dang sua chua" sau khi
  // gan xong, khong can nguoi dung tu bam lai tab.
  const [tab, setTab] = useState(location.state?.tab || 'waiting_repair');
  const [search, setSearch] = useState('');
  const [view, setView] = useState(null);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [completedPopupOrder, setCompletedPopupOrder] = useState(null);
  const PAGE_SIZE = 10;

  // silent=true dung cho auto-refresh nen (poll/focus lai tab) - khong bat
  // loading/spinner de tranh giat man hinh. Can thiet vi trang nay khong tu
  // cap nhat khi to truong ben kia bam Hoan thanh (chi doi bang truc tiep
  // trong DB, khong co websocket) - neu khong co polling thi co van phai
  // F5 tay moi thay phieu nhay sang "Cho thanh toan".
  const loadAll = ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setLoadError('');
    return listRepairSettlementsApi({ limit: 200 })
      .then((result) => setOrders(result.items || []))
      .catch((err) => { if (!silent) setLoadError(err.message || 'Không tải được danh sách phiếu quyết toán'); })
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    loadAll();
    // Poll 20s + refresh khi quay lai tab van giu lam luoi an toan (phong khi
    // SSE mat ket noi tam thoi) - duong chinh de biet to truong vua tich
    // xong/hoan thanh la SSE ben duoi (realtime, khong can cho poll).
    const intervalId = setInterval(() => loadAll({ silent: true }), 20000);
    const onFocus = () => loadAll({ silent: true });
    const onVisibility = () => { if (document.visibilityState === 'visible') loadAll({ silent: true }); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Realtime: to truong vua tich xong 1 dau muc / hoan thanh toan bo lenh sua
  // chua -> cap nhat ngay ca danh sach lan modal "Xem chi tiet" dang mo, khong
  // can F5 tay:
  //   - 'task-updated': nap lai dung phieu dang xem de tien do hien thi ngay.
  //   - 'order-completed': phieu goc da tu chuyen "Cho thanh toan" (xem
  //     RepairOrderRepositoryImpl.updateStatus) -> nap lai danh sach; neu
  //     dang mo dung modal chi tiet phieu do thi hien popup thong bao, doi
  //     CVDV bam X moi chuyen sang tab "Cho thanh toan" (khong tu dong nhay
  //     ngang khi ho dang doc do).
  //   - 'invoiced': PayOS webhook bao da nhan tien -> phieu tu dong xuat hoa
  //     don (RepairSettlementService.handlePayosWebhook) - nap lai danh sach;
  //     neu dang mo dung modal xem/in phieu nay thi dong modal va nhay thang
  //     sang tab "Da xuat hoa don" luon, khong can CVDV thao tac gi them.
  const handleRepairOrderEvent = (event) => {
    if (event.type === 'task-updated' && view && String(view.id) === String(event.settlementId)) {
      getRepairSettlementApi(view.id).then(setView).catch(() => {});
    }
    if (event.type === 'order-completed') {
      loadAll({ silent: true });
      if (view && String(view.id) === String(event.settlementId)) {
        setCompletedPopupOrder(view);
      }
    }
    if (event.type === 'invoiced') {
      loadAll({ silent: true });
      if (previewOrder && String(previewOrder.id) === String(event.settlementId)) {
        setPreviewOrder(null);
        setView(null);
        setTab('invoiced');
      }
    }
  };
  useRepairOrderEventsSSE(handleRepairOrderEvent, true);

  const handleCloseCompletedPopup = () => {
    setCompletedPopupOrder(null);
    setView(null);
    setTab('waiting_payment');
  };

  const counts = {
    waiting_repair: orders.filter((o) => o.status === 'waiting_repair').length,
    inprogress: orders.filter((o) => o.status === 'inprogress').length,
    waiting_payment: orders.filter((o) => o.status === 'waiting_payment').length,
    invoiced: orders.filter((o) => o.status === 'invoiced').length,
  };

  const filtered = orders.filter((o) =>
    o.status === tab &&
    (!search ||
      (o.code || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.customer?.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.vehicle?.licensePlate || '').toLowerCase().includes(search.toLowerCase()))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginated = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [tab, search]);

  // Danh sach chi tra ve thong tin tom tat (khong co items - de tranh phai
  // gop them bang service_order_items cho tung dong khi hien thi danh sach) -
  // moi cho can hang muc day du (xem chi tiet, in danh sach CV, xem/in phieu
  // quyet toan) phai goi rieng getById de lay day du, khong dung truc tiep
  // dong danh sach.
  const fetchFullOrder = async (o) => {
    try {
      return await getRepairSettlementApi(o.id);
    } catch {
      return o; // Giu nguyen thong tin tom tat da co, chi thieu bang hang muc.
    }
  };

  const handleViewDetail = async (o) => {
    setView(o);
    setView(await fetchFullOrder(o));
  };

  const handlePrintWorkList = async (o) => {
    printWorkList(await fetchFullOrder(o));
  };

  const handlePreview = async (o) => {
    setPreviewOrder(await fetchFullOrder(o));
  };

  // Phieu xe ra chi can thong tin dau phieu (khach hang, xe, ngay, tong tien)
  // - da co san ngay trong dong tom tat cua danh sach, khong can goi lai
  // fetchFullOrder (von chi de bo sung "items" day du).
  const handlePrintVehicleOut = (o) => {
    printVehicleOutSlip(o);
  };

  const handleConfirmCancel = async (reason) => {
    if (cancelTarget.kind === 'repair_order') {
      await updateRepairOrderStatusApi(cancelTarget.repairOrderId, 'cancelled', reason);
      // Huy lenh sua chua se tu dong lam phieu quyet toan goc quay ve "Cho
      // sua chua" (xem RepairOrderRepositoryImpl.updateStatus) - nap lai ca
      // danh sach cho chinh xac thay vi tu suy doan trang thai moi.
      await loadAll();
    } else {
      const updated = await updateRepairSettlementStatusApi(cancelTarget.id, 'cancelled', reason);
      setOrders((prev) => prev.filter((o) => o.id !== updated.id));
    }
    setCancelTarget(null);
  };

  // Chuyển tiếp nhanh sang màn "Lệnh sửa chữa" để gán tổ trưởng, khỏi phải tự
  // chuyển trang rồi tìm lại đúng phiếu này trong danh sách.
  const handleAssign = (settlementId) => {
    navigate('/repair-orders/create', { state: { settlementId } });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Phiếu quyết toán sửa chữa</h1>
          <div className="breadcrumb">Trang chủ / Phiếu quyết toán sửa chữa</div>
        </div>
        <div className="page-header-right">
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
            {user?.branchName || user?.branch || MOCK_BRANCH}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const count = counts[t.key] ?? 0;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: '2px solid',
                borderColor: isActive ? ACTIVE_TAB_COLOR : 'var(--gray-300)',
                background: isActive ? ACTIVE_TAB_COLOR : 'var(--gray-100)',
                color: isActive ? 'white' : 'var(--gray-700)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {t.label}
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.3)' : 'var(--gray-300)',
                color: isActive ? 'white' : 'var(--gray-600)',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{count}</span>
            </button>
          );
        })}
        <div className="search-input" style={{ marginLeft: 'auto', minWidth: 260 }}>
          <input style={{ paddingLeft: 12 }} placeholder="Mã RO, biển số, tên khách hàng..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loadError && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#C62828' }}>
          {loadError}
        </div>
      )}

      {tab === 'waiting_payment' && counts.waiting_payment > 0 && (
        <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#2E7D32' }}>
          Nhấn <b>In phiếu và xuất hóa đơn</b> để xem/in phiếu quyết toán và hoàn tất dịch vụ.
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Số RO</th><th>Khách hàng</th><th>Xe</th><th>Tổ trưởng</th>
              <th>Ngày tiếp nhận</th><th>Tổng tiền</th><th>Trạng thái</th><th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <p>Đang tải danh sách phiếu…</p>
                </div>
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <h3>Chưa có phiếu quyết toán nào</h3>
                  <p>Không có phiếu nào ở trạng thái này.</p>
                </div>
              </td></tr>
            )}
            {paginated.map((o) => {
              const st = STATUS_LABELS[o.status];
              return (
                <tr key={o.id} style={{ background: o.status === 'waiting_payment' ? '#F9FBE7' : undefined }}>
                  <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{o.code}</span></td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{o.customer?.fullName}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{o.customer?.phone}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.vehicle?.licensePlate}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{o.vehicle?.vehicleModel}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {o.teamLeader ? <span>{o.teamLeader}</span> : <span style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Chưa gán</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{o.date}</td>
                  <td style={{ fontWeight: 700, color: '#C62828' }}>{formatCurrency(o.total)}</td>
                  <td><span className={`badge ${st?.badge}`}>{st?.label}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-info btn-sm" style={{ fontSize: 11 }} onClick={() => handleViewDetail(o)}>Xem chi tiết</button>

                      {o.status === 'waiting_repair' && (<>
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => handleAssign(o.id)}>Phân công</button>
                        <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => setCancelTarget({ kind: 'settlement', id: o.id, code: o.code })}>Hủy</button>
                      </>)}

                      {o.status === 'inprogress' && (<>
                        <button className="btn btn-sm" style={{ fontSize: 11, background: '#00897B', color: '#fff' }} onClick={() => handlePrintWorkList(o)}>In danh sách CV</button>
                        {o.repairOrderId && (
                          <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => setCancelTarget({ kind: 'repair_order', repairOrderId: o.repairOrderId, code: o.code })}>Hủy</button>
                        )}
                      </>)}

                      {o.status === 'waiting_payment' && (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11, background: '#2E7D32', borderColor: '#2E7D32' }}
                          onClick={() => handlePreview(o)}>
                          In phiếu và xuất hóa đơn
                        </button>
                      )}

                      {o.status === 'invoiced' && (
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => handlePrintVehicleOut(o)}>In phiếu xe ra</button>
                      )}

                      {canManage && o.status !== 'invoiced' && o.status !== 'waiting_payment' && (
                        // Khong truyen state={{ order: o }} - dong o lay tu danh sach KHONG co
                        // items day du (xem fetchFullOrder), truyen thang vao se lam form luu
                        // ghi de mat het hang muc cong viec cua phieu. De trang Chinh sua tu
                        // goi getRepairSettlementApi(id) lay day du.
                        <Link to={`/repair-settlement/edit/${o.id}`} className="btn btn-warning btn-sm" style={{ fontSize: 11 }}>Chỉnh sửa</Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12, color: 'var(--gray-500)' }}>
          <div>Tổng {filtered.length} phiếu</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>Trước</button>
            <span>Trang {pageSafe}/{totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau</button>
          </div>
        </div>
      )}

      {view && !completedPopupOrder && (
        <DetailModal
          order={view}
          onClose={() => setView(null)}
          onPreview={setPreviewOrder}
        />
      )}

      {completedPopupOrder && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal modal-sm" style={{ textAlign: 'center' }}>
            <div className="modal-header" style={{ justifyContent: 'flex-end', border: 'none', paddingBottom: 0 }}>
              <button className="modal-close" onClick={handleCloseCompletedPopup}>✕</button>
            </div>
            <div className="modal-body" style={{ paddingTop: 0 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>Phiếu sửa chữa này đã hoàn thành</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-600)' }}>
                {completedPopupOrder.code} — tổ trưởng đã hoàn thành toàn bộ công việc. Phiếu đã chuyển sang <b>Chờ thanh toán</b>.
              </p>
            </div>
          </div>
        </div>
      )}

      {previewOrder && (
        <SettlementPreviewModal
          order={previewOrder}
          onClose={() => setPreviewOrder(null)}
        />
      )}

      {cancelTarget && (
        <CancelReasonModal
          title={cancelTarget.kind === 'repair_order'
            ? `Hủy lệnh sửa chữa ${cancelTarget.code}`
            : `Hủy phiếu quyết toán ${cancelTarget.code}`}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Modal nhập lý do hủy phiếu (chỉ áp dụng khi phiếu đang Chờ sửa chữa) ──
function CancelReasonModal({ title, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do hủy');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err.message || 'Hủy thất bại');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label required">Lý do hủy</label>
            <textarea
              className="form-textarea"
              placeholder="Nhập lý do hủy phiếu…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
          {error && <div className="form-error" style={{ marginTop: 6 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Trở lại</button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Đang xử lý…' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form tạo / chỉnh sửa phiếu quyết toán sửa chữa ─────────────────
// Wrapper: khi sửa phiếu mà không có sẵn `location.state.order` (vào thẳng
// URL, ví dụ F5 lại trang), tự tải phiếu từ API theo :id trước khi mount form.
function RepairSettlementForm({ isEdit }) {
  const location = useLocation();
  const { id } = useParams();
  const stateOrder = location.state?.order || null;
  const [fetchedOrder, setFetchedOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(isEdit && !stateOrder);
  const [loadOrderError, setLoadOrderError] = useState('');

  useEffect(() => {
    if (!isEdit || stateOrder || !id) return undefined;
    let alive = true;
    getRepairSettlementApi(id)
      .then((order) => { if (alive) setFetchedOrder(order); })
      .catch((err) => { if (alive) setLoadOrderError(err.message || 'Không tải được phiếu quyết toán'); })
      .finally(() => { if (alive) setLoadingOrder(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  if (loadingOrder) return <div className="page-loading">Đang tải phiếu quyết toán…</div>;
  if (loadOrderError) return <div className="page-loading">{loadOrderError}</div>;

  const existingOrder = stateOrder || fetchedOrder;
  return <RepairSettlementFormInner key={existingOrder?.id || 'new'} isEdit={isEdit} existingOrder={existingOrder} />;
}

function RepairSettlementFormInner({ isEdit, existingOrder }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const nowStr = new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const [customerQuery, setCustomerQuery] = useState(existingOrder?.customer?.fullName || '');
  const [plateQuery, setPlateQuery] = useState(existingOrder?.vehicle?.licensePlate || '');
  const [activeField, setActiveField] = useState(null); // 'customer' | 'plate' | 'frame' | 'engine' | 'phone'
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // true khi thông tin khách hàng đến từ tra cứu DB có sẵn -> che phone/email/cccd khi hiển thị
  const [isFromLookup, setIsFromLookup] = useState(Boolean(existingOrder?.customer?.phone));
  const searchSeq = useRef(0);

  const [customerInfo, setCustomerInfo] = useState(existingOrder?.customer || {
    fullName: '', address: '', phone: '', taxCode: '', cccd: '', email: '', contactPerson: '', contactPhone: '',
  });
  const [vehicleInfo, setVehicleInfo] = useState(existingOrder?.vehicle || {
    licensePlate: '', vehicleModel: '', frameNumber: '', engineNumber: '', purchaseDate: '', currentKm: '',
    warrantyEndDate: '', warrantyKmLimit: null,
  });

  const [customerRequest, setCustomerRequest] = useState(existingOrder?.customerRequest || '');
  // Bo dem chung sinh groupId - dung ca luc tai du lieu cu (assignGroupIds)
  // lan luc chon dich vu/goi moi trong phien lam viec nay (xem selectCatalog*).
  const catalogGroupSeq = useRef(0);
  const nextGroupId = () => ++catalogGroupSeq.current;
  const [items, setItems] = useState(() => assignGroupIds(
    existingOrder?.items?.length ? existingOrder.items : [emptyItem()],
    nextGroupId
  ));
  // Tra cứu hạng mục công việc / gói combo thật trong DB khi gõ ô "Mã hạng mục".
  const [activeCatalogIdx, setActiveCatalogIdx] = useState(null); // dòng nào đang mở dropdown gợi ý
  const [catalogSuggestions, setCatalogSuggestions] = useState({}); // idx -> { services, packages }
  // Toạ độ (viewport) của ô đang mở dropdown - dropdown render qua portal ra
  // ngoài table-wrapper (vốn overflow:auto để cuộn ngang bảng) để không bị cắt/cuộn kẹt.
  const [catalogDropdownRect, setCatalogDropdownRect] = useState(null);
  const catalogInputRef = useRef(null); // input dang mo dropdown - dung de tinh lai vi tri khi cuon trang
  const catalogSearchSeq = useRef(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Sau khi lưu 1 phiếu ĐANG chỉnh sửa (VD: khách yêu cầu sửa thêm), giữ lại
  // bản ghi vừa lưu để cho in lại ngay tại chỗ, không bắt quay về danh sách
  // rồi tìm lại phiếu để in.
  const [savedOrder, setSavedOrder] = useState(null);

  // Lỗi lưu phiếu hiện giữa màn hình dạng mockup, tự ẩn sau ~4s (không cần
  // đóng tay) - thay cho banner cố định trên đầu trang như trước.
  useEffect(() => {
    if (!saveError) return undefined;
    const timer = setTimeout(() => setSaveError(''), 4000);
    return () => clearTimeout(timer);
  }, [saveError]);

  // Tra cứu khách hàng/xe thật trong DB theo tên, biển số, số khung hoặc số máy.
  // Debounce 300ms; searchSeq huỷ kết quả của lần tra cứu cũ nếu đã có lần mới hơn.
  const queryByField = {
    customer: customerQuery,
    plate: plateQuery,
    frame: vehicleInfo.frameNumber,
    engine: vehicleInfo.engineNumber,
    phone: customerInfo.phone,
  };

  useEffect(() => {
    if (!activeField) return undefined;
    const term = (queryByField[activeField] || '').trim();
    if (term.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const results = await searchVehiclesApi(term);
        if (seq === searchSeq.current) setSuggestions(results || []);
      } catch {
        if (seq === searchSeq.current) setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeField, customerQuery, plateQuery, vehicleInfo.frameNumber, vehicleInfo.engineNumber, customerInfo.phone]);

  // Tra cứu hạng mục thật trong DB theo tên (hoặc mã), debounce 300ms giống các
  // ô tra cứu khách hàng/xe ở trên. Phạm vi tìm kiếm phụ thuộc LHSC của chính
  // dòng đó: "Dịch vụ" -> tìm trong catalog dịch vụ/gói combo; "Phụ tùng" ->
  // tìm trong kho phụ tùng của chi nhánh. Nhờ vậy cố vấn dịch vụ luôn chỉ thấy
  // đúng 1 loại gợi ý phù hợp, không bị rối giữa dịch vụ và phụ tùng.
  useEffect(() => {
    if (activeCatalogIdx === null) return undefined;
    const idx = activeCatalogIdx;
    const term = (items[idx]?.description || '').trim();
    const lhsc = items[idx]?.lhsc;
    if (term.length < 2) {
      setCatalogSuggestions((prev) => ({ ...prev, [idx]: null }));
      return undefined;
    }
    const seq = ++catalogSearchSeq.current;
    const timer = setTimeout(async () => {
      try {
        if (lhsc === 'PT') {
          const products = await searchProductsApi(term);
          if (seq === catalogSearchSeq.current) setCatalogSuggestions((prev) => ({ ...prev, [idx]: { type: 'product', products } }));
        } else {
          const result = await searchCatalogApi(term);
          if (seq === catalogSearchSeq.current) setCatalogSuggestions((prev) => ({ ...prev, [idx]: { type: 'catalog', ...result } }));
        }
      } catch {
        if (seq === catalogSearchSeq.current) setCatalogSuggestions((prev) => ({ ...prev, [idx]: null }));
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCatalogIdx, items[activeCatalogIdx]?.description, items[activeCatalogIdx]?.lhsc]);

  const fillFromRow = async (row) => {
    setShowSuggestions(false);

    // Kiem tra trung phieu TRUOC khi dien - neu trung thi khong dien gi ca,
    // chi bao loi, de khach hang/xe dang nhap do khong bi thay the.
    setSaveError('');
    try {
      const conflict = await checkDuplicateSettlementApi(row.customerId, row.vehicleId, existingOrder?.id);
      if (conflict) {
        setSaveError(conflict.message);
        return;
      }
    } catch {
      // Khong chan viec dien du lieu neu ban than buoc kiem tra bi loi mang.
    }

    setCustomerInfo({
      id: row.customerId, fullName: row.fullName, address: row.address || '', phone: row.phone || '',
      taxCode: row.taxCode || '', cccd: row.cccd || '', email: row.email || '',
      contactPerson: row.contactName || row.fullName, contactPhone: row.contactPhone || row.phone,
    });
    setVehicleInfo({
      id: row.vehicleId, licensePlate: row.licensePlate, vehicleModel: row.vehicleModel || '',
      frameNumber: row.frameNumber || '', engineNumber: row.engineNumber || '',
      purchaseDate: row.purchaseDate ? String(row.purchaseDate).slice(0, 10) : '', currentKm: '',
      warrantyEndDate: row.warrantyEndDate ? String(row.warrantyEndDate).slice(0, 10) : '',
      warrantyKmLimit: row.warrantyKmLimit ?? null,
    });
    setCustomerQuery(row.fullName);
    setPlateQuery(row.licensePlate);
    setIsFromLookup(true);
  };

  const cInfoSet = (k, v) => setCustomerInfo((p) => ({ ...p, [k]: v }));
  const vInfoSet = (k, v) => setVehicleInfo((p) => ({ ...p, [k]: v }));

  // Xoa toan bo thong tin da autofill (khach hang + xe) de tim lai tu dau -
  // dung khi chon nham khach hang, vi cac truong da bi khoa (readOnly) sau
  // khi autofill nen khong the sua tay duoc nua.
  const resetLookup = () => {
    setCustomerInfo({ fullName: '', address: '', phone: '', taxCode: '', cccd: '', email: '', contactPerson: '', contactPhone: '' });
    setVehicleInfo({ licensePlate: '', vehicleModel: '', frameNumber: '', engineNumber: '', purchaseDate: '', currentKm: '', warrantyEndDate: '', warrantyKmLimit: null });
    setCustomerQuery('');
    setPlateQuery('');
    setIsFromLookup(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveField('customer');
    // Chọn lại khách hàng khác -> phiếu cũ (hạng mục, yêu cầu KH, lịch bảo
    // dưỡng kế tiếp) không còn liên quan gì tới khách/xe mới nữa, reset về
    // trắng như mới mở form, tránh sót dữ liệu của khách cũ.
    setItems([emptyItem()]);
    setCustomerRequest('');
    setNextKm('');
    setNextDate('');
    setSaveError('');
  };

  const setItem = (idx, key, val) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = recalcItem({ ...next[idx], [key]: val });
      return next;
    });
  };

  // Dong con (duoc tu dong chen kem theo 1 dich vu/goi da chon - dich vu con
  // trong goi hoac phu tung tieu hao) khong duoc sua/xoa rieng le - chi dau
  // nhom (isGroupParent) moi thao tac duoc, xoa dau nhom se xoa het ca cum.
  // Rieng So luong cua dong phu tung con (lhsc 'PT') van cho sua tay truc tiep
  // (xem cot So luong ben duoi) - vi dinh muc phu tung uoc tinh theo cong thuc
  // co the lech thuc te, can co van dieu chinh duoc ma khong phai doi so luong
  // ca dau nhom (se keo theo ty le lam sai cac phu tung khac cung nhom).
  const isChildRow = (it) => Boolean(it.groupId) && !it.isGroupParent;

  // Doi Hinh thuc thanh toan tren dong dau nhom (dich vu/goi chinh) -> tu
  // dong ap dung luon cho tat ca cac dong con cung nhom (dich vu con, phu
  // tung) - vi thuc te ca nhom luon thanh toan chung 1 hinh thuc, khong ai
  // chon rieng cho tung dong phu tung ben trong 1 goi ca.
  const handleHtttChange = (idx, value) => {
    setItems((prev) => {
      const next = [...prev];
      const groupId = next[idx]?.groupId;
      // Phai goi lai recalcItem (khong chi merge httt) vi "total" phu thuoc
      // vao httt (dong duoc mien thu khach - bao hanh/bao hiem/noi bo - luon
      // tra ve 0) - neu khong Thanh tien se giu nguyen gia tri CU, sai voi
      // HTTT vua doi.
      next[idx] = recalcItem({ ...next[idx], httt: value });
      if (next[idx].isGroupParent && groupId) {
        for (let j = 0; j < next.length; j += 1) {
          if (j !== idx && next[j].groupId === groupId) {
            next[j] = recalcItem({ ...next[j], httt: value });
          }
        }
      }
      return next;
    });
  };

  // Doi So luong tren dong dau nhom -> tinh lai theo ty le (so luong moi /
  // so luong cu) cho tat ca dong con cung nhom (dich vu con + phu tung), vi
  // dinh muc phu tung/dich vu con duoc tinh theo 1 lan lam goi/dich vu nay.
  // rawValue la chuoi tho tu input (khong Number() truoc) de cho phep go
  // "xoa het roi go so khac" di qua trang thai rong that su thay vi bi ep
  // ve 0 - ep ve 0 se lam mat moc so luong cu that (0 la falsy).
  //
  // "qtyBasis" luu ngay trong tung dong (KHONG dung ref/bien ngoai) de nho
  // moc so luong hop le gan nhat, song vuot qua nhip go rong tam thoi luc
  // xoa-roi-go-lai. Bat buoc phai la state thuan (khong side-effect ben
  // ngoai) vi React StrictMode (dev) goi ham cap nhat cua setState 2 lan de
  // kiem tra do "thuan" - neu dung ref bi mutate ben trong ham cap nhat, lan
  // goi dau (se bi huy) da lam ref "chay truoc" gia tri moi, khien lan goi
  // thu 2 (lan duoc giu lai) tinh oldQty = newQty -> ty le = 1 -> nhin như
  // khong doi (day chinh la nguyen nhan bug "doi so luong dau nhom nhung
  // dong con khong doi theo").
  const handleGroupQtyChange = (idx, rawValue) => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[idx];
      const isEmpty = rawValue === '';
      const parsed = Number(rawValue);
      const newQty = isEmpty || Number.isNaN(parsed) ? '' : parsed;
      const oldQty = target.qtyBasis || target.qty || 1;
      const updatedHead = recalcItem({ ...target, qty: newQty });
      if (typeof newQty === 'number' && newQty > 0) {
        updatedHead.qtyBasis = newQty;
      }
      next[idx] = updatedHead;
      if (target.isGroupParent && target.groupId && oldQty > 0 && typeof newQty === 'number' && newQty > 0) {
        const ratio = newQty / oldQty;
        for (let j = 0; j < next.length; j += 1) {
          if (j !== idx && next[j].groupId === target.groupId) {
            const scaledQty = Math.max(1, Math.round((next[j].qty || 1) * ratio));
            next[j] = recalcItem({ ...next[j], qty: scaledQty });
          }
        }
      }
      return next;
    });
  };

  // "Thêm dòng" luôn thêm 1 dòng Dịch vụ (mặc định của emptyItem) - không cần
  // chọn Loại hạng mục trước như cũ nữa. Muốn thêm 1 phụ tùng rời (không qua
  // dịch vụ nào) thì dùng addPartItem.
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const addPartItem = () => setItems((prev) => [...prev, { ...emptyItem(), lhsc: 'PT', unit: 'Cái' }]);
  // Xoa 1 dong "dau nhom" (dich vu/goi vua chon tu catalog) thi don dep luon
  // cac dong phu tung/dich vu con tu dong chen kem theo no - tranh de sot lai
  // hang muc mo coi khong con gan voi dich vu/goi nao ca. Xoa 1 dong con rieng
  // le (vi du chi xoa 1 dong phu tung trong nhom) thi van chi xoa dung dong do.
  const removeItem = (idx) => setItems((prev) => {
    if (prev.length <= 1) return prev;
    const target = prev[idx];
    const remaining = (target?.isGroupParent && target.groupId)
      ? prev.filter((it, i) => i !== idx && it.groupId !== target.groupId)
      : prev.filter((_, i) => i !== idx);
    // Xoa 1 goi/dich vu ma no la TOAN BO cac dong dang co (vi du chi vua chon
    // 1 goi combo duy nhat, chua co dong nao khac) se lam remaining rong -
    // luc do tra ve 1 dong Dich vu trong moi (giong luc moi mo form), KHONG
    // tra ve nguyen "prev" cu (truoc day tra "prev" khien bam Xoa nhu khong
    // co gi xay ra, vi remaining rong bi coi la "khong hop le").
    return remaining.length > 0 ? remaining : [emptyItem()];
  });

  const handleItemDescription = (idx, val) => {
    setItem(idx, 'description', val);
    setActiveCatalogIdx(idx);
  };

  // Chuyen 1 mang phu tung (dinh muc BOM cua dich vu/goi vua chon) thanh cac
  // dong hang muc phu tung, chen ngay sau dong dich vu tuong ung - dung khop
  // voi cach phieu quyet toan thuc te liet ke rieng "PHU TUNG, VAT TU" ben
  // duoi cac dong "CONG VIEC CAN THUC HIEN". So luong lay theo dinh muc,
  // co van van sua lai duoc sau neu thuc te dung nhieu/it hon.
  function buildPartRows(parts, repairCategory) {
    return (parts || []).map((p) => recalcItem({
      ...emptyItem(),
      code: p.productCode,
      productId: p.productId,
      description: p.productName,
      unitPrice: p.unitPrice || 0,
      unit: p.unitName || 'Cái',
      qty: p.quantity || 1,
      lhsc: 'PT',
      httt: 'KHT',
      repairCategory: repairCategory || '',
    }));
  }

  // Gop dinh muc phu tung cua TAT CA dich vu con trong 1 goi combo - neu 2
  // dich vu trong goi cung dung 1 phu tung thì cộng dồn số lượng, tránh liệt
  // kê trùng 2 dòng cho cùng 1 phụ tùng.
  function mergePackageParts(pkg) {
    const map = new Map();
    for (const it of pkg.items || []) {
      for (const p of it.parts || []) {
        if (map.has(p.productId)) {
          map.get(p.productId).quantity += p.quantity;
        } else {
          map.set(p.productId, { ...p });
        }
      }
    }
    return Array.from(map.values());
  }

  const closeCatalogSuggestions = (idx) => {
    setCatalogSuggestions((prev) => ({ ...prev, [idx]: null }));
    setActiveCatalogIdx((cur) => (cur === idx ? null : cur));
    setCatalogDropdownRect(null);
    catalogInputRef.current = null;
  };

  const openCatalogDropdown = (idx, inputEl) => {
    catalogInputRef.current = inputEl;
    const rect = inputEl.getBoundingClientRect();
    setCatalogDropdownRect({ top: rect.bottom, left: rect.left, width: rect.width });
    setActiveCatalogIdx(idx);
  };

  // Toa do duoc chup 1 lan luc focus - neu trang cuon (form nay rat dai) trong
  // luc go chu cho toi khi ket qua tra ve, dropdown (position: fixed) se dung
  // yen tai vi tri cu trong khi o input da di chuyen tren man hinh, gay ra
  // hien tuong dropdown "troi" sang vi tri khac (vd de len khu vuc Lich bao
  // duong/Tong ket ben duoi). Can tinh lai vi tri moi khi trang cuon/resize.
  useEffect(() => {
    if (activeCatalogIdx === null) return undefined;
    const updateRect = () => {
      const el = catalogInputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCatalogDropdownRect({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [activeCatalogIdx]);

  // Chọn 1 hạng mục đơn lẻ từ catalog -> điền đúng dòng đang gõ, không giảm
  // giá, tự điền luôn Loại hình sửa chữa đã khai báo sẵn cho dịch vụ này (nếu
  // có), rồi tự chèn thêm các dòng phụ tùng theo đúng định mức của dịch vụ
  // này ngay bên dưới (giống phiếu quyết toán thực tế - phụ tùng tiêu hao
  // liệt kê riêng bên dưới phần công việc), cùng 1 Loại hình sửa chữa.
  const selectCatalogService = (idx, svc) => {
    const repairCategory = svc.repairCategory || '';
    setItems((prev) => {
      // Dong nay truoc do da la dau nhom (vd doi sang dich vu khac) -> bo het
      // phu tung cu di kem truoc khi chen bo phu tung moi, tranh de sot orphan.
      const oldGroupId = prev[idx]?.groupId;
      const withoutCurrent = prev.filter((it, i) => {
        if (i === idx) return false;
        if (oldGroupId && it.groupId === oldGroupId) return false;
        return true;
      });

      // Dich vu vua chon da TRUNG voi 1 dong co san o noi khac (vd dich vu con
      // duoc goi lon tu dong chen kem truoc do) -> cong don +1 so luong vao
      // dong do, mo khoa cho sua so luong tay, KHONG tao them dong/nhom moi
      // (tranh liet ke trung lap cung 1 hang muc 2 lan).
      const dupIdx = withoutCurrent.findIndex((it) => it.serviceId === svc.id);
      if (dupIdx !== -1) {
        const next = [...withoutCurrent];
        const target = next[dupIdx];
        const newQty = (target.qtyBasis || target.qty || 1) + 1;
        next[dupIdx] = recalcItem({ ...target, qty: newQty, qtyBasis: newQty, manualQtyUnlock: true });
        return next;
      }

      const groupId = nextGroupId();
      const newHead = recalcItem({ ...emptyItem(), code: svc.code, serviceId: svc.id, productId: null, description: svc.name, unitPrice: svc.unitPrice, unit: 'Công', lhsc: 'DV', httt: 'KHT', discount: 0, repairCategory, groupId, isGroupParent: true });
      const partRows = buildPartRows(svc.parts, repairCategory).map((r) => ({ ...r, groupId }));
      const next = [...withoutCurrent];
      next.splice(idx, 0, newHead, ...partRows);
      return next;
    });
    closeCatalogSuggestions(idx);
  };

  // Chọn 1 gói combo -> dòng gói mang đúng giá trọn gói (như phiếu thực tế:
  // "BẢO DƯỠNG CẤP 3" 1 dòng có Thành tiền), CHÈN THÊM ngay dưới các dòng
  // dịch vụ con (gói đơn) chỉ để liệt kê công việc đã bao gồm - không có giá
  // riêng (đơn giá/thành tiền = 0, không cộng thêm vào tổng vì gộp trong giá
  // gói rồi), rồi chèn tiếp các dòng phụ tùng gộp từ định mức của TẤT CẢ dịch
  // vụ con trong gói.
  const selectCatalogPackage = (idx, pkg) => {
    // Uu tien Loai hinh sua chua khai bao rieng cho GOI; neu goi chua khai
    // bao thi lay tam theo dich vu con dau tien co khai bao - van tot hon
    // de trong, cho van chi can sua lai 1 lan neu chua dung.
    const repairCategory = pkg.repairCategory || pkg.items.find((it) => it.repairCategory)?.repairCategory || '';
    setItems((prev) => {
      // Dong nay truoc do da la dau nhom (vd doi sang goi khac) -> bo het dich
      // vu con/phu tung cu di kem truoc khi chen bo moi, tranh de sot orphan.
      const oldGroupId = prev[idx]?.groupId;
      const base = oldGroupId ? prev.filter((it, i) => i === idx || it.groupId !== oldGroupId) : prev;
      let next = [...base];
      const groupId = nextGroupId();
      next[idx] = recalcItem({
        ...next[idx],
        code: pkg.code,
        serviceId: null,
        productId: null,
        description: pkg.name,
        unitPrice: pkg.totalPrice,
        unit: 'Công',
        qty: 1,
        lhsc: 'DV',
        httt: 'KHT',
        discount: 0,
        repairCategory,
        groupId,
        isGroupParent: true,
      });
      const subServiceRows = pkg.items.map((it) => recalcItem({
        ...emptyItem(),
        code: it.serviceCode,
        serviceId: it.serviceId,
        description: it.serviceName,
        unitPrice: 0,
        unit: 'Công',
        qty: 1,
        lhsc: 'DV',
        httt: 'KHT',
        repairCategory,
        groupId,
      }));
      const partRows = buildPartRows(mergePackageParts(pkg), repairCategory).map((r) => ({ ...r, groupId }));
      next.splice(idx + 1, 0, ...subServiceRows, ...partRows);
      return next;
    });
    closeCatalogSuggestions(idx);
  };

  // Chọn 1 phụ tùng thật trong kho -> điền đúng dòng đang gõ, đơn giá và ĐVT
  // lấy theo đúng thông tin đã khai báo trong kho (products), không giảm giá.
  const selectProduct = (idx, product) => {
    setItems((prev) => {
      // Phu tung vua chon da TRUNG voi 1 dong co san o noi khac (vd phu tung
      // phu thuoc cua 1 goi/dich vu da chon truoc do) -> cong don +1 so luong
      // vao dong do, mo khoa cho sua so luong tay, bo dong dang go di (khong
      // can them dong rieng nua) - tranh liet ke trung lap cung 1 phu tung.
      const dupIdx = prev.findIndex((it, i) => i !== idx && it.productId === product.id);
      if (dupIdx !== -1) {
        const next = prev.filter((_, i) => i !== idx);
        const adjDupIdx = dupIdx > idx ? dupIdx - 1 : dupIdx;
        const target = next[adjDupIdx];
        const newQty = (target.qtyBasis || target.qty || 1) + 1;
        next[adjDupIdx] = recalcItem({ ...target, qty: newQty, qtyBasis: newQty, manualQtyUnlock: true });
        return next;
      }

      const next = [...prev];
      next[idx] = recalcItem({
        ...next[idx],
        code: product.productCode,
        serviceId: null,
        productId: product.id,
        description: product.productName,
        unitPrice: product.unitPrice || 0,
        unit: product.unitName || next[idx].unit,
        lhsc: 'PT',
        httt: 'KHT',
        discount: 0,
      });
      return next;
    });
    closeCatalogSuggestions(idx);
  };

  const totals = calcTotals(items);

  // Bắt buộc phải chọn khách hàng/xe từ gợi ý tra cứu (có id thật trong DB)
  // trước khi cho lưu — không tự tạo khách hàng/xe mới ở phiếu này.
  const canSave = Boolean(customerInfo.id) && Boolean(vehicleInfo.id);

  const buildPayload = () => ({
    customerId: customerInfo.id,
    vehicleId: vehicleInfo.id,
    customerRequest,
    currentKm: vehicleInfo.currentKm || null,
    items,
    ...totals,
  });

  const handleSave = async () => {
    if (!canSave) {
      setSaveError('Vui lòng chọn khách hàng và xe từ gợi ý tra cứu trước khi lưu.');
      return;
    }
    if (vehicleInfo.currentKm === '' || vehicleInfo.currentKm == null) {
      setSaveError('Vui lòng nhập số km hiện tại của xe trước khi lưu.');
      return;
    }
    if (!customerRequest.trim()) {
      setSaveError('Vui lòng nhập mô tả yêu cầu của khách hàng trước khi lưu.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const payload = buildPayload();
      if (isEdit) {
        const result = await updateRepairSettlementApi(existingOrder.id, payload);
        setSaving(false);
        setSaved(true);
        setSavedOrder(result);
        return;
      }
      await createRepairSettlementApi(payload);
    } catch (err) {
      setSaveError(err.message || 'Lưu phiếu quyết toán thất bại');
      setSaving(false);
      return;
    }
    setSaving(false);
    setSaved(true);
    navigate('/repair-settlement');
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{isEdit ? 'Chỉnh sửa phiếu quyết toán' : 'Tạo phiếu quyết toán sửa chữa'}</h1>
          <div className="breadcrumb">
            <Link to="/repair-settlement">Phiếu quyết toán sửa chữa</Link> / {isEdit ? 'Chỉnh sửa' : 'Tạo mới'}
          </div>
        </div>
      </div>

      {saved && (
        <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#2E7D32' }}>
          {savedOrder ? 'Đã lưu thay đổi phiếu quyết toán.' : 'Đã lưu phiếu quyết toán. Đang quay lại danh sách…'}
        </div>
      )}

      {saveError && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, pointerEvents: 'none' }}>
          <div style={{ background: '#C62828', color: '#fff', borderRadius: 10, padding: '18px 28px', maxWidth: 520, fontSize: 14, fontWeight: 600, textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            {saveError}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Cố vấn dịch vụ', value: user?.name || 'Cố vấn dịch vụ' },
          { label: 'Chi nhánh', value: user?.branchName || user?.branch || MOCK_BRANCH },
          { label: 'Ngày tiếp nhận', value: existingOrder?.date || nowStr, mono: true },
        ].map((b) => (
          <div key={b.label} style={{ background: 'var(--primary-very-light)', border: '1px solid var(--primary-light)', borderRadius: 8, padding: '10px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{b.label}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-dark)', fontFamily: b.mono ? 'monospace' : undefined }}>{b.value}</div>
          </div>
        ))}
      </div>

      {/* SECTION 1: Khách hàng & xe */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Thông tin khách hàng & xe</span>
          {isFromLookup && (
            <button className="btn btn-secondary btn-sm" onClick={resetLookup}>Chọn lại khách hàng</button>
          )}
        </div>
        <div className="card-body">
          <div className="form-grid form-grid-2">
            <div>
              <div className="form-group" style={{ position: 'relative', marginBottom: 12 }}>
                <label className="form-label required">Tên khách hàng</label>
                <input className="form-input"
                  value={customerQuery}
                  readOnly={isFromLookup}
                  onChange={(e) => { setCustomerQuery(e.target.value); cInfoSet('fullName', e.target.value); setIsFromLookup(false); setActiveField('customer'); setShowSuggestions(true); }}
                  onFocus={() => { if (!isFromLookup) { setActiveField('customer'); setShowSuggestions(true); } }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                  placeholder="Nhập tên" />
                {activeField === 'customer' && showSuggestions && suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 100 }}>
                    {suggestions.map((row) => (
                      <div key={`${row.customerId}-${row.vehicleId}`} onMouseDown={() => fillFromRow(row)}
                        style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{row.fullName}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{row.phone} • {row.licensePlate}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Địa chỉ</label>
                <input className="form-input" value={customerInfo.address} readOnly={isFromLookup} onChange={(e) => cInfoSet('address', e.target.value)} placeholder="Địa chỉ khách hàng" />
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label required">Điện thoại</label>
                  <input className="form-input"
                    value={customerInfo.phone}
                    readOnly={isFromLookup}
                    onChange={(e) => { cInfoSet('phone', e.target.value); setIsFromLookup(false); setActiveField('phone'); setShowSuggestions(true); }}
                    onFocus={() => { if (!isFromLookup) { setActiveField('phone'); setShowSuggestions(true); } }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                    placeholder="0912345678" />
                  {activeField === 'phone' && showSuggestions && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 100 }}>
                      {suggestions.map((row) => (
                        <div key={`${row.customerId}-${row.vehicleId}`} onMouseDown={() => fillFromRow(row)}
                          style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{row.phone} — {row.fullName}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{row.licensePlate}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Mã Số Thuế</label>
                  <input className="form-input" value={customerInfo.taxCode} readOnly={isFromLookup} onChange={(e) => cInfoSet('taxCode', e.target.value)} placeholder="Mã số thuế" />
                </div>
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">CCCD</label>
                  <input className="form-input"
                    value={customerInfo.cccd}
                    readOnly={isFromLookup}
                    onChange={(e) => { cInfoSet('cccd', e.target.value); setIsFromLookup(false); }}
                    placeholder="Số CCCD / CMND" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input"
                    value={customerInfo.email}
                    readOnly={isFromLookup}
                    onChange={(e) => { cInfoSet('email', e.target.value); setIsFromLookup(false); }}
                    placeholder="email@example.com" />
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Người liên hệ</label>
                  <input className="form-input" value={customerInfo.contactPerson} onChange={(e) => cInfoSet('contactPerson', e.target.value)} placeholder="Tên người liên hệ" />
                </div>
                <div className="form-group">
                  <label className="form-label">Điện thoại liên hệ</label>
                  <input className="form-input" value={customerInfo.contactPhone} onChange={(e) => cInfoSet('contactPhone', e.target.value)} placeholder="SĐT người liên hệ" />
                </div>
              </div>
            </div>

            <div>
              <div className="form-group" style={{ position: 'relative', marginBottom: 12 }}>
                <label className="form-label required">Biển số xe</label>
                <input className="form-input"
                  value={plateQuery}
                  readOnly={isFromLookup}
                  onChange={(e) => { setPlateQuery(e.target.value); vInfoSet('licensePlate', e.target.value); setIsFromLookup(false); setActiveField('plate'); setShowSuggestions(true); }}
                  onFocus={() => { if (!isFromLookup) { setActiveField('plate'); setShowSuggestions(true); } }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                  placeholder="Nhập biển số xe" />
                {activeField === 'plate' && showSuggestions && suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 100 }}>
                    {suggestions.map((row) => (
                      <div key={`${row.customerId}-${row.vehicleId}`} onMouseDown={() => fillFromRow(row)}
                        style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{row.licensePlate} — {row.vehicleModel}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{row.fullName} • {row.phone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Loại xe</label>
                <input className="form-input" value={vehicleInfo.vehicleModel} readOnly={isFromLookup} onChange={(e) => vInfoSet('vehicleModel', e.target.value)} placeholder=" " />
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Số khung</label>
                  <input className="form-input" value={vehicleInfo.frameNumber}
                    readOnly={isFromLookup}
                    onChange={(e) => { vInfoSet('frameNumber', e.target.value); setIsFromLookup(false); setActiveField('frame'); setShowSuggestions(true); }}
                    onFocus={() => { if (!isFromLookup) { setActiveField('frame'); setShowSuggestions(true); } }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 180)} />
                  {activeField === 'frame' && showSuggestions && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 100 }}>
                      {suggestions.map((row) => (
                        <div key={`${row.customerId}-${row.vehicleId}`} onMouseDown={() => fillFromRow(row)}
                          style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{row.frameNumber} — {row.licensePlate}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{row.fullName} • {row.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Số máy</label>
                  <input className="form-input" value={vehicleInfo.engineNumber}
                    readOnly={isFromLookup}
                    onChange={(e) => { vInfoSet('engineNumber', e.target.value); setIsFromLookup(false); setActiveField('engine'); setShowSuggestions(true); }}
                    onFocus={() => { if (!isFromLookup) { setActiveField('engine'); setShowSuggestions(true); } }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 180)} />
                  {activeField === 'engine' && showSuggestions && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 100 }}>
                      {suggestions.map((row) => (
                        <div key={`${row.customerId}-${row.vehicleId}`} onMouseDown={() => fillFromRow(row)}
                          style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{row.engineNumber} — {row.licensePlate}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{row.fullName} • {row.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Ngày mua</label>
                  <input className="form-input" type="date" value={vehicleInfo.purchaseDate} readOnly={isFromLookup} onChange={(e) => vInfoSet('purchaseDate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label required">Số Km hiện tại</label>
                  <input className="form-input" type="number" value={vehicleInfo.currentKm} onChange={(e) => vInfoSet('currentKm', e.target.value)} />
                </div>
              </div>
              {(() => {
                const warranty = getWarrantyStatus(vehicleInfo);
                if (!warranty) return null;
                return (
                  <div
                    style={{
                      marginTop: 10, fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '6px 10px',
                      background: warranty.covered ? '#E8F5E9' : '#F5F5F5',
                      color: warranty.covered ? '#2E7D32' : '#757575',
                    }}
                  >
                    {warranty.label}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label required">Yêu cầu của khách hàng</label>
            <textarea className="form-textarea" rows={2} value={customerRequest} onChange={(e) => setCustomerRequest(e.target.value)} placeholder="Mô tả tình trạng xe / yêu cầu sửa chữa của khách hàng..." />
          </div>
        </div>
      </div>

      {/* SECTION 2: Hạng mục công việc */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Hạng mục công việc / phụ tùng</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={addItem} disabled={!canSave}
              title={canSave ? undefined : 'Vui lòng chọn khách hàng và xe trước'}>Thêm dịch vụ</button>
            <button className="btn btn-secondary btn-sm" onClick={addPartItem} disabled={!canSave}
              title={canSave ? undefined : 'Vui lòng chọn khách hàng và xe trước'}>Thêm phụ tùng</button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Mã số</th>
                  <th style={{ minWidth: 260 }}>Nội dung công việc</th>
                  <th style={{ width: 180 }}>Loại hình sửa chữa</th>
                  <th style={{ width: 190 }}>Hình thức thanh toán</th>
                  <th style={{ width: 100 }}>Đơn vị tính</th>
                  <th style={{ width: 70 }}>Số lượng</th>
                  <th style={{ width: 150 }}>Đơn giá</th>
                  <th style={{ width: 110 }}>Chiết khấu (%)</th>
                  <th style={{ width: 130 }}>Thành tiền</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const indexed = items.map((item, idx) => ({ item, idx }));
                  const laborRows = indexed.filter(({ item }) => item.lhsc !== 'PT');
                  const partRows = indexed.filter(({ item }) => item.lhsc === 'PT');
                  const laborSubtotal = laborRows.reduce((s, { item }) => s + (item.total || 0), 0);
                  const partSubtotal = partRows.reduce((s, { item }) => s + (item.total || 0), 0);

                  const renderRow = ({ item, idx }) => {
                    const suggestion = catalogSuggestions[idx];
                    const isPartRow = item.lhsc === 'PT';
                    const isChild = isChildRow(item);
                    const hasSuggestions = activeCatalogIdx === idx && suggestion && (
                      suggestion.type === 'product'
                        ? suggestion.products?.length > 0
                        : (suggestion.packages?.length > 0 || suggestion.services?.length > 0)
                    );
                    return (
                    <tr key={idx} style={{ background: rowColorForGroup(item.groupId) }}>
                      <td>
                        <input className="form-input" style={{ fontSize: 11, fontFamily: 'monospace', background: 'transparent' }} value={item.code || ''} readOnly />
                      </td>
                      <td style={{ position: 'relative' }}>
                        <input className="form-input" style={{ fontSize: 12, background: 'transparent' }} value={item.description} disabled={!canSave} readOnly={isChild}
                          onChange={(e) => handleItemDescription(idx, e.target.value)}
                          onFocus={(e) => !isChild && openCatalogDropdown(idx, e.target)}
                          onBlur={() => setTimeout(() => closeCatalogSuggestions(idx), 180)}
                          placeholder={canSave ? (isPartRow ? 'Nhập tên/mã phụ tùng trong kho...' : 'Nhập tên dịch vụ / gói combo...') : 'Vui lòng chọn khách hàng và xe trước'} />
                        {hasSuggestions && catalogDropdownRect && createPortal(
                          <div style={{ position: 'fixed', top: catalogDropdownRect.top, left: catalogDropdownRect.left, width: 440, maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 1000 }}>
                            {suggestion.type === 'product' && suggestion.products?.length > 0 && (
                              <div>
                                <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--primary-dark)', background: 'var(--primary-very-light)' }}>Phụ tùng trong kho</div>
                                {suggestion.products.map((p) => (
                                  <div key={`prod-${p.id}`} onMouseDown={() => selectProduct(idx, p)}
                                    style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)' }}>
                                    <div style={{ fontWeight: 600 }}>{p.productName} <span style={{ color: 'var(--gray-500)', fontWeight: 400 }}>({p.productCode})</span></div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>
                                      {formatCurrency(p.unitPrice)} / {p.unitName} · Tồn: {p.stockQuantity}
                                      {p.isLowStock && <span style={{ color: '#C62828', fontWeight: 600 }}> (sắp hết)</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {suggestion.type === 'catalog' && suggestion.packages?.length > 0 && (
                              <div>
                                <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--primary-dark)', background: 'var(--primary-very-light)' }}>Gói combo</div>
                                {suggestion.packages.map((pkg) => (
                                  <div key={`pkg-${pkg.id}`} onMouseDown={() => selectCatalogPackage(idx, pkg)}
                                    style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)' }}>
                                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg.name} <span style={{ color: 'var(--gray-500)', fontWeight: 400 }}>({pkg.items.length} hạng mục)</span></div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{formatCurrency(pkg.totalPrice)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {suggestion.type === 'catalog' && suggestion.services?.length > 0 && (
                              <div>
                                <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--primary-dark)', background: 'var(--primary-very-light)' }}>Hạng mục đơn lẻ</div>
                                {suggestion.services.map((svc) => (
                                  <div key={`svc-${svc.id}`} onMouseDown={() => selectCatalogService(idx, svc)}
                                    style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)' }}>
                                    <b>{svc.name}</b> <span style={{ color: 'var(--gray-500)' }}>({formatCurrency(svc.unitPrice)})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>,
                          document.body
                        )}
                      </td>
                      <td>
                        <input className="form-input" style={{ fontSize: 12, background: 'transparent' }}
                          value={REPAIR_CATEGORY_LABEL_BY_VALUE[item.repairCategory] || ''} readOnly
                          title="Loại hình sửa chữa lấy tự động theo dịch vụ/gói đã chọn, không chỉnh sửa trực tiếp trên form" />
                      </td>
                      <td>
                        {isChild ? (
                          <input className="form-input" style={{ fontSize: 12, background: 'transparent' }} value={HTTT_LABEL_BY_VALUE[item.httt] || ''} readOnly />
                        ) : (
                          <select className="form-select" style={{ fontSize: 12, background: 'transparent' }} value={item.httt} onChange={(e) => handleHtttChange(idx, e.target.value)}>
                            <option value=""></option>
                            {HTTT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        )}
                      </td>
                      <td>
                        {item.lhsc === 'DV' ? (
                          <input className="form-input" style={{ fontSize: 12, background: 'transparent' }} value="Công" readOnly />
                        ) : isChild ? (
                          <input className="form-input" style={{ fontSize: 12, background: 'transparent' }} value={item.unit} readOnly />
                        ) : (
                          <select className="form-select" style={{ fontSize: 12, background: 'transparent' }} value={item.unit} onChange={(e) => setItem(idx, 'unit', e.target.value)}>
                            {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        )}
                      </td>
                      <td>
                        <input className="form-input" style={{ fontSize: 12, background: 'transparent' }} type="number" min={1} value={item.qty} readOnly={isChild && item.lhsc !== 'PT' && !item.manualQtyUnlock} onChange={(e) => handleGroupQtyChange(idx, e.target.value)} />
                      </td>
                      <td>
                        <input className="form-input" style={{ fontSize: 12, background: 'transparent' }}
                          value={(item.unitPrice || 0).toLocaleString('vi-VN')} readOnly
                          title="Đơn giá lấy theo catalog/kho phụ tùng, không chỉnh sửa trực tiếp trên form" />
                      </td>
                      <td>
                        <input className="form-input" style={{ fontSize: 12, background: 'transparent' }} type="number" min={0} max={100} value={item.discount} readOnly={isChild} onChange={(e) => setItem(idx, 'discount', Number(e.target.value))} />
                      </td>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {(item.total || 0).toLocaleString('vi-VN')}
                        {exemptionShortLabel(item) && <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}> ({exemptionShortLabel(item)})</span>}
                      </td>
                      <td>
                        {!isChild && (
                          <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => removeItem(idx)}>Xóa</button>
                        )}
                      </td>
                    </tr>
                    );
                  };

                  return (
                    <>
                      <tr>
                        <td style={{ background: 'var(--gray-200)' }}></td>
                        <td colSpan={9} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>CÔNG VIỆC CẦN THỰC HIỆN</td>
                      </tr>
                      {laborRows.map(renderRow)}
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                        <td style={{ fontWeight: 700 }}>{laborSubtotal.toLocaleString('vi-VN')}</td>
                        <td></td>
                      </tr>

                      {partRows.length > 0 && (
                        <>
                          <tr>
                            <td style={{ background: 'var(--gray-200)' }}></td>
                            <td colSpan={9} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>PHỤ TÙNG, VẬT TƯ</td>
                          </tr>
                          {partRows.map(renderRow)}
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                            <td style={{ fontWeight: 700 }}>{partSubtotal.toLocaleString('vi-VN')}</td>
                            <td></td>
                          </tr>
                        </>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {/* Tổng kết */}
        <div className="card" style={{ width: '100%', maxWidth: 340, position: 'sticky', top: 70, alignSelf: 'start' }}>
          <div className="card-header"><span className="card-title">Tổng kết thanh toán</span></div>
          <div className="card-body">
            <div className="summary-box" style={{ marginBottom: 14 }}>
              <div className="summary-row"><span>Tổng trước giảm giá:</span><span>{totals.subtotal.toLocaleString('vi-VN')} đ</span></div>
              <div className="summary-row"><span>Tổng giảm giá:</span><span>{totals.discountAmount.toLocaleString('vi-VN')} đ</span></div>
              <div className="summary-row"><span>Thuế giá trị gia tăng (8%):</span><span>{totals.vat.toLocaleString('vi-VN')} đ</span></div>
              {totals.freeAmount > 0 && (
                <div className="summary-row"><span>Miễn phí:</span><span>{totals.freeAmount.toLocaleString('vi-VN')} đ</span></div>
              )}
              <div className="summary-row total"><span>Tổng thanh toán:</span><span>{formatCurrency(totals.total)}</span></div>
            </div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--gray-600)', marginBottom: 14 }}>
              Bằng chữ: {numberToVietnamese(totals.total)}
            </div>

            {!canSave && (
              <div style={{ fontSize: 12, color: '#E65100', marginBottom: 8 }}>
                Vui lòng chọn khách hàng và xe từ gợi ý tra cứu để có thể lưu.
              </div>
            )}

            {savedOrder ? (
              <>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
                  onClick={() => printSettlement(savedOrder)}>
                  In lại phiếu quyết toán
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
                  onClick={() => printWorkList(savedOrder)}>
                  In danh sách công việc
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => navigate('/repair-settlement')}>
                  Quay lại danh sách
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
                  disabled={!canSave || saving}
                  onClick={handleSave}>
                  {saving ? 'Đang lưu…' : 'Lưu phiếu quyết toán'}
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                  onClick={() => navigate('/repair-settlement')}>
                  Quay lại
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────
export default function RepairSettlementPage() {
  const { user } = useAuth();
  const canManage = user?.primaryRole !== ROLES.ADMIN;

  return (
    <Routes>
      <Route index element={<RepairSettlementList />} />
      <Route
        path="create"
        element={canManage ? <RepairSettlementForm /> : <Navigate to="/repair-settlement" replace />}
      />
      <Route
        path="edit/:id"
        element={canManage ? <RepairSettlementForm isEdit /> : <Navigate to="/repair-settlement" replace />}
      />
    </Routes>
  );
}
