import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useToast } from '../../components/common/ToastContext';
import { useRepairOrderEventsSSE } from '../../hooks/useRepairOrderEventsSSE';
import { ROLES } from '../../constants/roles';
import { actionLabel, consumesPart } from '../../constants/maintenanceChecklist';
import { formatCurrency } from '../../utils';
import { searchVehiclesApi, listVehicleModelsApi } from '../../services/vehicleApi';
import { searchCatalogApi } from '../../services/catalogApi';
import { searchProductsApi } from '../../services/productApi';
import {
  listRepairSettlementsApi,
  getRepairSettlementApi,
  checkDuplicateSettlementApi,
  createRepairSettlementApi,
  updateRepairSettlementApi,
  updateRepairSettlementStatusApi,
  logRepairSettlementPrintApi,
  createPayosPaymentLinkApi,
  lockSettlementApi,
  unlockSettlementApi,
  getSettlementActivityLogApi,
} from '../../services/repairSettlementApi';
import { MOCK_BRANCH, STATUS_LABELS } from './mockData';
import { isValidPhone, isValidEmail, EMAIL_HINT } from '../../utils/validation';
import IntakeChecklistSection, { DEFAULT_INTAKE_CHECKLIST, isIntakeChecklistComplete } from './IntakeChecklistSection';
import IntakeChecklistView from './IntakeChecklistView';
import SignaturePad from './SignaturePad';
import './RepairSettlementPage.css';

// Poll du phong 15s cho cac vung can realtime trong file nay - phong khi mat
// ket noi SSE tam thoi, cung nguong voi cac man khac da dung pattern nay
// (TeamLeaderDashboard.jsx, Landing BayScreen.jsx).
const POLL_INTERVAL_MS = 15000;

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
  { value: 'CB', label: 'Sửa chữa gầm' },
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
// "Khách hủy" - khach dang sua nua chung thi keu huy 1 hang muc (khong phai
// huy ca phieu). KHONG nam trong HTTT_OPTIONS (danh sach chon binh thuong) vi
// chi duoc phep chon khi: dang o man Chinh sua phieu "dang sua chua" VA hang
// muc do CHUA duoc to truong/tho tick hoan thanh - xem canCancelItemHttt().
const HTTT_CANCELLED_VALUE = 'HUY';
const HTTT_CANCELLED_OPTION = { value: HTTT_CANCELLED_VALUE, label: 'Khách hủy' };
const HTTT_LABEL_BY_VALUE = Object.fromEntries([...HTTT_OPTIONS, HTTT_CANCELLED_OPTION].map((o) => [o.value, o.label]));
// CCCD (12 so, mau moi) hoac CMND cu (9 so) - khop voi BE CCCD_REGEX.
const CCCD_REGEX = /^[0-9]{9}([0-9]{3})?$/;
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
  { key: 'cancelled', label: 'Đã hủy' },
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
  return { code: '', serviceId: null, productId: null, description: '', lhsc: 'DV', httt: '', repairCategory: '', unit: 'Công', qty: 1, unitPrice: 0, discount: 0, total: 0, note: '', actionCode: null };
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

// Hạng mục có HTTT = Bảo hành hãng xe / Bảo hiểm chi trả / Nội bộ chịu phí /
// Khách hủy -> khách không phải trả, nên loại khỏi số tiền thu khách.
function isExemptFromCustomerBilling(item) {
  return item.httt === 'BHH' || item.httt === 'BH' || item.httt === 'NB' || item.httt === HTTT_CANCELLED_VALUE;
}

// Nhan ngan gon hien ben canh so 0 o cot "Thanh tien" cho dong duoc mien thu
// khach (vd "0 (Bảo hành)") - de co van biet ngay VI SAO dong nay la 0 ma
// khong can doi chieu qua cot HTTT.
const EXEMPTION_SHORT_LABEL = { BHH: 'Bảo hành', BH: 'Bảo hiểm', NB: 'Nội bộ', [HTTT_CANCELLED_VALUE]: 'Khách hủy' };
function exemptionShortLabel(item) {
  return EXEMPTION_SHORT_LABEL[item.httt] || null;
}

// Phu tung da giam so luong so voi luc luu truoc do (khach hoan tra bot/het
// hang - vd thao lai phu tung da lap vi khach doi y, xem handleGroupQtyChange)
// - ghi chu ben canh so tien de co van biet ngay vi sao Thanh tien thap hon
// don gia*so luong ban dau, khong nham voi cac dong bi mien thu qua HTTT.
function isQuantityReturned(item) {
  return item.lhsc === 'PT' && item.originalQty != null && Number(item.qty) < Number(item.originalQty);
}

// Nhan hien thi 1 tho trong "Thợ thực hiện" - kem "(Điều động)" neu tho nay
// khong cung to voi to truong dang phu trach lenh sua chua (dieu dong tu to
// khac sang giup, xem RepairOrder.sameTeam/RepairSettlement.technicians[].sameTeam).
function formatTechnicianLabel(t) {
  return t.sameTeam === false ? `${t.fullName} (Điều động)` : t.fullName;
}

// Hien thi 1 dau muc trong "Tien do cong viec" - hang muc bi khach huy giua
// chung (isCancelled) hoac moi duoc CVDV them vao SAU luc to truong da nhan
// viec (isAddedLater) deu can ghi ro o cuoi ten, xem
// repairOrderTaskBuilder.js/computeDesiredTasks. Tach rieng ten (co the gach
// ngang neu huy) voi phan mo ngoac o cuoi ("(Khách hủy)"/"(Khách thêm)"...)
// LUON KHONG gach ngang - CSS text-decoration cua phan tu cha se "xuyen qua"
// ca span con dau du span con tu dat text-decoration:none (dac thu cua
// text-decoration, khong giong color), nen phai tach thanh 2 <span> ANH EM
// (khong long nhau) thay vi dua het vao 1 chuoi roi gach ngang ca the
// <label>/div cha.
function TaskNameLabel({ t }) {
  // So luong GIAM so voi prev_quantity (khach hoan tra bot, khong phai huy
  // han) - "SL xN" la CHENH LECH (khac voi "tổng là: N" cua truong hop TANG
  // o duoi, vi TANG chi can biet tong moi con GIAM can biet ro tra lai bao
  // nhieu). Neu giam het ve 0 (van chua qua "Khách hủy" chinh thuc) thi coi
  // nhu da tra lai toan bo - gach ngang giong isCancelled, xem
  // RepairSettlementRepositoryImpl._syncRepairOrderTasks.
  const qtyReturned = t.prevQuantity != null && Number(t.quantity) < Number(t.prevQuantity)
    ? Number(t.prevQuantity) - Number(t.quantity)
    : 0;
  const fullyReturned = !t.isCancelled && qtyReturned > 0 && Number(t.quantity) === 0;
  const struckThrough = t.isCancelled || fullyReturned;
  const suffix = t.isCancelled
    ? ' (Khách hủy)'
    : qtyReturned > 0
      ? ` (Khách trả lại SL x${qtyReturned})`
      : t.isQtyIncreased
        ? ` (Khách thêm số lượng, tổng là: ${t.quantity})`
        : t.isAddedLater
          ? ' (Khách thêm)'
          : '';
  return (
    <>
      <span style={{ textDecoration: struckThrough ? 'line-through' : 'none' }}>{t.taskName}</span>
      {suffix && <span style={{ textDecoration: 'none' }}>{suffix}</span>}
    </>
  );
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

function logPrintBestEffort(order, kind) {
  if (!order?.id) return;
  logRepairSettlementPrintApi(order.id, kind).catch(() => {});
}

// ─── In danh sách công việc (cho KTV) ────────────────────────────────
// Export de dung chung o man Lenh sua chua (RepairOrderPage) - in danh sach
// cong viec cho to truong sau khi phan cong xong, cung 1 mau in nhu o day.
export function printWorkList(order) {
  logPrintBestEffort(order, 'worklist');
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
  logPrintBestEffort(order, 'settlement');
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

// ─── Modal xem trước & xuất phiếu quyết toán ────────────────────────
function SettlementPreviewModal({ order, onClose }) {
  // Chi con dung de doi chu nut in ("In phieu" vs "In lai phieu").
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

  // Phuong thuc thu cong thu 2 (ben canh PayOS/chuyen khoan) - khach tra tien
  // mat tai quay, CVDV tu bam xac nhan thay vi cho quet QR. Goi thang API
  // status='invoiced' (BE tu ghi payment_method='CASH' cho duong nay, xem
  // RepairSettlementService.updateStatus) - SSE 'invoiced' se tu dong dong
  // modal/chuyen tab, khong can xu ly gi them o day ngoai bat cai overlay loading.
  const [confirmingCash, setConfirmingCash] = useState(false);
  const [cashError, setCashError] = useState('');
  const [showCashConfirm, setShowCashConfirm] = useState(false);

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

  const handleConfirmCash = async () => {
    setShowCashConfirm(false);
    setConfirmingCash(true);
    setCashError('');
    try {
      await updateRepairSettlementStatusApi(order.id, 'invoiced');
      // Dong modal ngay (khong doi SSE) - danh sach ngoai man se tu cap nhat
      // qua SSE 'invoiced' rieng (da bat san o RepairSettlementList), khong
      // phu thuoc vao modal nay con mo hay khong.
      onClose();
    } catch (err) {
      setCashError(err.message || 'Xác nhận thất bại, vui lòng thử lại');
      setConfirmingCash(false);
    }
  };

  // Chan goi trung khi mo modal - React StrictMode (dev) chay effect 2 lan,
  // neu khong chan se tao 2 payment link PayOS khac nhau cho cung 1 phieu.
  const payosRequestedForRef = useRef(null);
  useEffect(() => {
    if (order.status === 'waiting_payment' && payosRequestedForRef.current !== order.id) {
      payosRequestedForRef.current = order.id;
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
                {(() => {
                  const indexed = (order.items || []).map((s, i) => ({ s, i }));
                  const laborRows = indexed.filter(({ s }) => s.lhsc !== 'PT');
                  const partRows = indexed.filter(({ s }) => s.lhsc === 'PT');
                  const laborSubtotal = laborRows.reduce((sum, { s }) => sum + (s.total || 0), 0);
                  const partSubtotal = partRows.reduce((sum, { s }) => sum + (s.total || 0), 0);

                  const renderRow = ({ s, i }) => (
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
                  );

                  return (
                    <>
                      <tr>
                        <td colSpan={2} style={{ background: 'var(--gray-200)' }}></td>
                        <td colSpan={6} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>CÔNG VIỆC CẦN THỰC HIỆN</td>
                      </tr>
                      {laborRows.map(renderRow)}
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                        <td style={{ fontWeight: 700, textAlign: 'right' }}>{laborSubtotal.toLocaleString('vi-VN')}</td>
                      </tr>

                      {partRows.length > 0 && (
                        <>
                          <tr>
                            <td colSpan={2} style={{ background: 'var(--gray-200)' }}></td>
                            <td colSpan={6} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>PHỤ TÙNG, VẬT TƯ</td>
                          </tr>
                          {partRows.map(renderRow)}
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                            <td style={{ fontWeight: 700, textAlign: 'right' }}>{partSubtotal.toLocaleString('vi-VN')}</td>
                          </tr>
                        </>
                      )}
                    </>
                  );
                })()}
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
                    {cashError && <div style={{ fontSize: 9, color: '#C62828', maxWidth: 130, textAlign: 'center' }}>{cashError}</div>}
                  </>
                ) : (
                  <div style={{
                    width: 130, height: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #A5D6A7', borderRadius: 8, background: '#E8F5E9',
                    textAlign: 'center', fontSize: 12, color: '#2E7D32', fontWeight: 600, padding: 6, gap: 4,
                  }}>
                    <span>✓ Đã thanh toán</span>
                    {order.paymentMethod && (
                      <span style={{ fontSize: 10, fontWeight: 400 }}>
                        ({order.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'})
                      </span>
                    )}
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
          {order.status === 'waiting_payment' && (
            <button className="btn btn-primary" disabled={confirmingCash} onClick={() => setShowCashConfirm(true)}>
              {confirmingCash ? 'Đang xử lý…' : 'Xác nhận tiền mặt'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={handlePrint}>
            {hasPrinted ? 'In lại phiếu quyết toán' : 'In phiếu quyết toán'}
          </button>
        </div>
      </div>

      {showCashConfirm && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()} style={{ zIndex: 1100 }}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Xác nhận thanh toán tiền mặt</span>
              <button className="modal-close" onClick={() => setShowCashConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                Bạn xác nhận đã nhận được số tiền{' '}
                <b style={{ color: 'red' }}>{(order.total || 0).toLocaleString('vi-VN')}đ</b>{' '}
                từ khách hàng <b>{order.customer?.fullName}</b>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger" onClick={() => setShowCashConfirm(false)}>Hủy</button>
              <button
                className="btn btn-primary"
                style={{ background: '#2E7D32', borderColor: '#2E7D32' }}
                onClick={handleConfirmCash}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// BE chuyen status sang 'inprogress' ngay luc Tổ trưởng chọn khoang (claim) -
// truoc ca khi gan tho, de khoa khong cho khoang khac nhan trung phieu (xem
// RepairOrderRepositoryImpl.claim). Nhung ben man CVDV chi nen hien "Đang sửa
// chữa" tu luc THUC SU co tho duoc gan - truoc do van hien nhu "Chờ sửa chữa"
// de khong gay hieu nham la da co nguoi bat tay vao lam.
function displayStatus(o) {
  if (o.status === 'inprogress' && !o.hasTechnicians) return 'waiting_repair';
  return o.status;
}

// ─── Modal xem chi tiết phiếu ────────────────────────────────────────
// Khung thu gon duoc cua form tao/sua phieu. Form nay rat dai (khach hang +
// xe, tiep nhan/ban giao, hang muc, chu ky) nen cho phep gap tung khung lai
// de con vien tap trung vao phan dang lam.
//
// Noi dung KHONG bi unmount khi thu gon (chi display:none) - phai giu nguyen
// canvas chu ky (SignaturePad giu ref + net ve), o dang go do, va vi tri cuon.
// Neu render co dieu kien thi chu ky da ve se mat khi gap khung lai.
//
// Bam vao mui ten hoac tieu de de gap/mo; cac nut thao tac o ben phai (Chon
// lai khach hang, Them dich vu...) nam ngoai vung bam nen khong bi anh huong.
function CollapsibleCard({ title, note, summary, actions, open, onToggle, bodyStyle, children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={onToggle} aria-expanded={open}
          title={open ? 'Thu gọn' : 'Mở rộng'}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none',
            padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit',
          }}>
          <span style={{
            fontSize: 11, color: 'var(--gray-500)', width: 16, textAlign: 'center',
            transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none',
          }}>▶</span>
          <span className="card-title">{title}</span>
        </button>
        {note}
        {!open && summary && (
          <span style={{ fontSize: 12, color: 'var(--gray-600)', fontStyle: 'italic' }}>{summary}</span>
        )}
        {actions && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      <div className="card-body" style={open ? bodyStyle : { display: 'none' }}>{children}</div>
    </div>
  );
}

function DetailModal({ order, onClose, onPreview, canEdit, onEdit }) {
  const st = STATUS_LABELS[displayStatus(order)];
  const [showIntake, setShowIntake] = useState(false);
  return (
    <div className="modal-overlay" style={{ gap: 16 }} onClick={onClose}>
      <div
        className="modal modal-xl no-scrollbar"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: showIntake ? 'min(680px, 54vw)' : 900,
          transition: 'max-width 0.25s ease',
          borderRadius: 14,
          overflowX: 'hidden',
        }}
      >
        <div className="modal-header">
          <h3 className="modal-title">Quyết toán sửa chữa – {order.code}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`badge ${st?.badge}`}>{st?.label}</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="responsive-2col" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
            <div style={{ minWidth: 0 }}>
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
            <div style={{ minWidth: 0 }}>
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

          {order.cancelReason && (
            <>
              <div className="form-section-title">Lý do hủy</div>
              <div style={{ background: '#FFEBEE', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 16, color: '#C62828' }}>
                {order.cancelReason}
              </div>
            </>
          )}

          <div className="form-section-title">Hạng mục công việc</div>
          <div className="table-wrapper" style={{ marginBottom: 0 }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr><th>#</th><th>Mã</th><th>Nội dung công việc</th><th>LHSC</th><th>HTTT</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>CK%</th><th>Thành tiền</th><th>Ghi chú</th></tr>
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
                        {/* Yêu cầu thực hiện của biểu mẫu "Phiếu kiểm tra BDĐK" -
                            chỉ đầu mục con của gói bảo dưỡng mới có. */}
                        {actionLabel(item.actionCode) && (
                          <div style={{ fontSize: 11, color: 'var(--gray-600)', fontStyle: 'italic' }}>{actionLabel(item.actionCode)}</div>
                        )}
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
                      <td style={{ color: 'var(--gray-600)', fontStyle: item.note ? 'normal' : 'italic' }}>{item.note || '—'}</td>
                    </tr>
                  );

                  return (
                    <>
                      <tr>
                        <td colSpan={2} style={{ background: 'var(--gray-200)' }}></td>
                        <td colSpan={9} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>CÔNG VIỆC CẦN THỰC HIỆN</td>
                      </tr>
                      {laborRows.map(renderRow)}
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                        <td style={{ fontWeight: 700, textAlign: 'right' }}>{laborSubtotal.toLocaleString('vi-VN')}</td>
                        <td></td>
                      </tr>

                      {partRows.length > 0 && (
                        <>
                          <tr>
                            <td colSpan={2} style={{ background: 'var(--gray-200)' }}></td>
                            <td colSpan={9} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>PHỤ TÙNG, VẬT TƯ</td>
                          </tr>
                          {partRows.map(renderRow)}
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                            <td style={{ fontWeight: 700, textAlign: 'right' }}>{partSubtotal.toLocaleString('vi-VN')}</td>
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

          {(() => {
            const serviceTasks = (order.tasks || []).filter((t) => t.taskType === 'service');
            if (serviceTasks.length === 0) return null;
            const activeServiceTasks = serviceTasks.filter((t) => !t.isCancelled);
            const doneCount = activeServiceTasks.filter((t) => t.isDone).length;
            return (
              <div style={{ marginTop: 16 }}>
                <div className="form-section-title">
                  Tiến độ công việc ({doneCount}/{activeServiceTasks.length})
                </div>
                {(order.bayNumber || order.technicians?.length > 0) && (
                  <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 8 }}>
                    {order.bayNumber && <>Khoang đang thực hiện: <b>{order.bayNumber}</b></>}
                    {order.bayNumber && order.technicians?.length > 0 && '  ·  '}
                    {order.technicians?.length > 0 && <>Thợ thực hiện: <b>{order.technicians.map(formatTechnicianLabel).join(', ')}</b></>}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {serviceTasks.map((t) => (
                    <label
                      key={t.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        background: t.isCancelled ? 'var(--gray-50)' : (t.isDone ? '#E8F5E9' : 'var(--gray-50)'), borderRadius: 6,
                        fontSize: 13,
                        color: t.isCancelled ? 'var(--gray-400)' : (t.isDone ? '#2E7D32' : 'var(--gray-900)'),
                      }}
                    >
                      <input type="checkbox" checked={t.isDone} disabled readOnly style={{ accentColor: '#2E7D32' }} />
                      <TaskNameLabel t={t} />
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {order.signatureData ? (
              <div className="card" style={{ flex: '1 1 280px', maxWidth: 360 }}>
                <div className="card-body">
                  <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                    Xác nhận đồng ý phiếu quyết toán
                  </div>
                  <img
                    src={order.signatureData}
                    alt="Chữ ký xác nhận"
                    style={{ display: 'block', margin: '0 auto', height: 90, border: '1px solid var(--gray-200)', borderRadius: 6, background: '#fff' }}
                  />
                  {order.signerName && (
                    <div style={{
                      textAlign: 'center', fontSize: 12.5, fontWeight: 600, marginTop: 10,
                      borderTop: '1px solid var(--gray-200)', paddingTop: 8,
                    }}>
                      {order.signerName}
                    </div>
                  )}
                  {order.signedAt && (
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                      Ký lúc: {order.signedAt}
                    </div>
                  )}
                </div>
              </div>
            ) : <div />}

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
          <button className="btn btn-secondary" onClick={() => setShowIntake((s) => !s)}>
            {showIntake ? 'Ẩn xem tình trạng xe ban đầu' : 'Xem tình trạng xe ban đầu'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
          {canEdit && (
            <button className="btn btn-warning" onClick={onEdit}>Chỉnh sửa phiếu</button>
          )}
          {(order.status === 'waiting_payment' || order.status === 'invoiced') && (
            <button className="btn btn-primary" style={{ background: '#2E7D32', borderColor: '#2E7D32' }}
              onClick={() => { onClose(); onPreview(order); }}>
              Xem / In phiếu quyết toán
            </button>
          )}
        </div>
      </div>

      {showIntake && (
        <div
          className="modal modal-xl no-scrollbar"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: 'min(440px, 38vw)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 14,
            overflowX: 'hidden',
          }}
        >
          <div className="modal-header">
            <h3 className="modal-title">Tiếp nhận và bàn giao xe</h3>
            <button className="modal-close" onClick={() => setShowIntake(false)}>✕</button>
          </div>
          <div className="modal-body">
            <IntakeChecklistView value={order.intakeChecklist} vehicleModelText={order.vehicle?.vehicleModel} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Danh sách phiếu quyết toán sửa chữa ─────────────────────────────
// "dd/mm/yyyy HH:mm" (o.date) -> "yyyy-mm-dd" de so sanh voi <input type="date">
// (chuoi ISO so sanh lexicographic dung thu tu thoi gian).
function toComparableDate(ddmmyyyyHHmm) {
  const [dd, mm, yyyy] = (ddmmyyyyHHmm || '').split(' ')[0].split('/');
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm}-${dd}`;
}

// "dd/mm/yyyy HH:mm" -> timestamp de sap xep tab "Đã xuất hóa đơn" theo thoi
// gian thanh toan gan nhat truoc (0 neu khong parse duoc, tu roi xuong cuoi).
function toTimestamp(ddmmyyyyHHmm) {
  const [datePart, timePart] = (ddmmyyyyHHmm || '').split(' ');
  const [dd, mm, yyyy] = (datePart || '').split('/');
  if (!dd || !mm || !yyyy) return 0;
  const [hh = '0', min = '0'] = (timePart || '').split(':');
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min)).getTime();
}

function RepairSettlementList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const canManage = user?.primaryRole !== ROLES.ADMIN;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Menu 2 lua chon (Truy cap phieu / Nhat ky hoat dong) tren tung dong - chi
  // 1 dong mo cung luc, luu id phieu dang mo menu. Render qua portal (xem
  // menuRect - toa do viewport cua nut vua bam) ra NGOAI .table-wrapper (von
  // overflow:auto de cuon ngang bang, xem catalogDropdownRect o form Tao/Sua
  // cho 1 truong hop tuong tu) de khong bi cat mat o cot cuoi cung ben phai.
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [menuRect, setMenuRect] = useState(null);
  // Menu nao dang mo NGAY TRUOC cu bam hien tai - dung de bam lai dung dong
  // dang mo thi dong menu (toggle), xem handler mousedown ben duoi.
  const menuOpenBeforeClickRef = useRef(null);

  // Dong menu khi bam ra ngoai. Truoc day dung 1 lop phu toan man hinh
  // (position:fixed; inset:0) - no dong menu that, nhung NUOT luon cu bam:
  // bam nut "Huy" thi menu dong ma nut khong chay, bam sang dong khac thi menu
  // cua dong do khong mo len. Nghe o tang document (pha capture, chay TRUOC
  // onClick cua React) thi menu van dong ma cu bam van toi duoc dich that su.
  useEffect(() => {
    if (menuOpenId === null) return undefined;
    const onDocMouseDown = (e) => {
      // Bam trong chinh menu: de cac muc tu xu ly (chung tu dong menu).
      if (e.target.closest?.('[data-row-menu]')) return;
      menuOpenBeforeClickRef.current = menuOpenId;
      setMenuOpenId(null);
      setMenuRect(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [menuOpenId]);
  // Phieu dang xem "Nhat ky hoat dong" (modal rieng, khong lien quan view/khoa).
  const [activityLogFor, setActivityLogFor] = useState(null);
  // Khoa "dang mo phieu" (xem lockSettlementApi) - id phieu dang giu khoa +
  // interval gia han 20s/lan trong luc con mo view. Dung ref (khong phai
  // state) vi chi doc/ghi trong callback/cleanup, khong can re-render.
  const lockedIdRef = useRef(null);
  const lockIntervalRef = useRef(null);
  const releaseLockIfHeld = useCallback(() => {
    if (lockIntervalRef.current) {
      clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }
    if (lockedIdRef.current) {
      unlockSettlementApi(lockedIdRef.current).catch(() => {});
      lockedIdRef.current = null;
    }
  }, []);
  // Nha khoa neu con giu luc roi khoi man hinh (chuyen tab/route khac) ma
  // chua bam nut dong view - luoi an toan cuoi cung truoc khi cho TTL 60s tu
  // het han (xem RepairSettlementRepositoryImpl.acquireLock).
  useEffect(() => () => releaseLockIfHeld(), [releaseLockIfHeld]);
  // Sau khi phan cong to truong xong (RepairOrderCreate) hoac tu cac luong
  // dieu huong khac muon mo san 1 tab cu the, co the truyen state: { tab }
  // khi navigate() toi day - vd chuyen thang sang "Dang sua chua" sau khi
  // gan xong, khong can nguoi dung tu bam lai tab.
  const [tab, setTab] = useState(location.state?.tab || 'waiting_repair');
  const [search, setSearch] = useState('');
  // Cac bo loc bo sung - AND voi nhau va voi search/tab (loc kep). Tổ trưởng
  // ap dung moi tab (phieu nao chua co to truong se khong khop khi loc chon 1
  // ten cu the, dung nhu ky vong); hinh thuc thanh toan chi co y nghia o tab
  // "Đã xuất hóa đơn" nen chi hien dropdown do o dung tab nay.
  const [filterTeamLeader, setFilterTeamLeader] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [view, setView] = useState(null);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState(null);
  const PAGE_SIZE = 10;

  // silent=true dung cho auto-refresh nen (poll/focus lai tab) - khong bat
  // loading/spinner de tranh giat man hinh. Can thiet vi trang nay khong tu
  // cap nhat khi to truong ben kia bam Hoan thanh (chi doi bang truc tiep
  // trong DB, khong co websocket) - neu khong co polling thi co van phai
  // F5 tay moi thay phieu nhay sang "Cho thanh toan".
  const loadAll = ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setLoadError('');
    // scope=branch: bo loc "chi phieu cua chinh minh" - moi CVDV trong chi
    // nhanh deu thay het phieu cua nhau (kem "dang mo boi ai" tren tung dong,
    // xem cot lockedByName/lockedAt tra ve). BE da ho tro san co nay (dung
    // chung voi man "Lenh sua chua").
    return listRepairSettlementsApi({ limit: 200, scope: 'branch' })
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
  //     dang mo dung modal chi tiet phieu do thi tu dong dong modal va nhay
  //     thang sang tab "Cho thanh toan" luon, khong can popup xac nhan rieng.
  //   - 'invoiced': PayOS webhook bao da nhan tien -> phieu tu dong xuat hoa
  //     don (RepairSettlementService.handlePayosWebhook) - nap lai danh sach;
  //     neu dang mo dung modal xem/in phieu nay thi dong modal va nhay thang
  //     sang tab "Da xuat hoa don" luon, khong can CVDV thao tac gi them.
  //   - 'claimed': 1 to truong vua nhan phieu (payload khong doi khac biet
  //     duoc claim lan dau hay gan xong tho) -> nap lai danh sach ngay, khong
  //     cho toi vong poll 20s moi thay thay doi; neu dang mo dung modal xem
  //     chi tiet phieu do thi nap lai luon. Phieu chi THUC SU chuyen tab sang
  //     "Dang sua chua" tu luc co tho (hasTechnicians) - xem displayStatus()
  //     o tren, event nay chi la tin hieu "co gi do thay doi, nap lai".
  //   - 'new-pending': co phieu quyet toan moi (CVDV khac trong cung chi
  //     nhanh vua tao) -> nap lai danh sach ngay, tranh phai doi poll/F5 moi
  //     thay phieu moi.
  const handleRepairOrderEvent = (event) => {
    if (event.type === 'task-updated' && view && String(view.id) === String(event.orderId)) {
      getRepairSettlementApi(view.id).then(setView).catch(() => { });
    }
    if (event.type === 'new-pending') {
      loadAll({ silent: true });
    }
    if (event.type === 'claimed') {
      loadAll({ silent: true });
      if (view && String(view.id) === String(event.orderId)) {
        getRepairSettlementApi(view.id).then(setView).catch(() => { });
      }
    }
    if (event.type === 'order-completed') {
      loadAll({ silent: true });
      if (view && String(view.id) === String(event.orderId)) {
        setView(null);
        setTab('waiting_payment');
      }
    }
    if (event.type === 'invoiced') {
      loadAll({ silent: true });
      if (previewOrder && String(previewOrder.id) === String(event.orderId)) {
        setPreviewOrder(null);
        setView(null);
        setTab('invoiced');
      }
    }
    if (event.type === 'order-cancelled') {
      loadAll({ silent: true });
    }
    // 1 CVDV khac vua chiem/nha khoa "dang mo phieu" - nap lai danh sach de
    // cot "Đang mở bởi" cap nhat ngay, khong can cho poll 20s.
    if (event.type === 'locked' || event.type === 'unlocked') {
      loadAll({ silent: true });
    }
  };
  useRepairOrderEventsSSE(handleRepairOrderEvent, true);

  const counts = {
    waiting_repair: orders.filter((o) => displayStatus(o) === 'waiting_repair').length,
    inprogress: orders.filter((o) => displayStatus(o) === 'inprogress').length,
    waiting_payment: orders.filter((o) => o.status === 'waiting_payment').length,
    invoiced: orders.filter((o) => o.status === 'invoiced').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  // Danh sach Tổ trưởng duy nhat tu chinh du lieu dang co, cho dropdown loc -
  // khong goi API rieng, tranh phai dong bo them 1 nguon du lieu khac.
  const teamLeaderOptions = [...new Set(orders.map((o) => o.teamLeader).filter(Boolean))].sort();

  const filtered = orders.filter((o) => {
    if (displayStatus(o) !== tab) return false;
    if (search) {
      const s = search.toLowerCase();
      const matches = (o.code || '').toLowerCase().includes(s)
        || (o.customer?.fullName || '').toLowerCase().includes(s)
        || (o.vehicle?.licensePlate || '').toLowerCase().includes(s);
      if (!matches) return false;
    }
    if (filterTeamLeader && o.teamLeader !== filterTeamLeader) return false;
    if (tab === 'invoiced' && filterPaymentMethod && o.paymentMethod !== filterPaymentMethod) return false;
    const orderDate = toComparableDate(o.date);
    if (filterDateFrom && (!orderDate || orderDate < filterDateFrom)) return false;
    if (filterDateTo && (!orderDate || orderDate > filterDateTo)) return false;
    return true;
  });
  // Tab "Đã xuất hóa đơn" mac dinh xep theo thoi gian thanh toan thanh cong
  // gan hien tai nhat len dau (khong anh huong cac tab khac).
  if (tab === 'invoiced') {
    filtered.sort((a, b) => toTimestamp(b.paidDate) - toTimestamp(a.paidDate));
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginated = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [tab, search, filterTeamLeader, filterPaymentMethod, filterDateFrom, filterDateTo]);

  // Danh sach chi tra ve thong tin tom tat (khong co items - de tranh phai
  // gop them bang repair_order_items cho tung dong khi hien thi danh sach) -
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

  const handlePreview = async (o) => {
    setPreviewOrder(await fetchFullOrder(o));
  };

  // "Truy cập phiếu" (thay cho nut "Xem chi tiet" cu) - chiem khoa truoc khi
  // mo, chan 2 CVDV cung vao sua 1 phieu 1 luc. Neu dang bi nguoi khac giu
  // (409) thi bao ro ten + gio, khong mo view. Sau khi mo thanh cong, cu 20s
  // gui 1 nhip gia han (khop chu ky poll 20s da co san) de khoa khong tu het
  // han trong luc van con dang xem - xem RepairSettlementRepositoryImpl
  // .acquireLock (LOCK_TTL_SECONDS = 60, gap 3 lan chu ky nay).
  const handleAccessSettlement = async (o) => {
    try {
      await lockSettlementApi(o.id);
    } catch (err) {
      if (err.status === 409) {
        const name = err.details?.lockedByName || 'người khác';
        toast.warning(`Phiếu đang được ${name} mở, vui lòng thử lại sau.`);
      } else {
        toast.error(err.message || 'Không thể mở phiếu, vui lòng thử lại');
      }
      return;
    }
    releaseLockIfHeld(); // phong khi truoc do dang giu khoa 1 phieu khac chua nha.
    lockedIdRef.current = o.id;
    lockIntervalRef.current = setInterval(() => {
      lockSettlementApi(o.id).catch(() => {});
    }, 20000);
    await handleViewDetail(o);
  };

  const handleOpenActivityLog = (o) => setActivityLogFor(o);

  // Huy phieu quyet toan la MOT chieu du dang o trang thai nao (chua nhan
  // hay dang sua chua deu duoc) - BE tu cascade huy luon lenh sua chua neu
  // da co (xem RepairSettlementRepositoryImpl.updateStatus), khong con quay
  // ve "Cho sua chua" de nhan lai nhu truoc nua.
  const handleConfirmCancel = async (reason) => {
    const updated = await updateRepairSettlementStatusApi(cancelTarget.id, 'cancelled', reason);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setCancelTarget(null);
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

      {/* Bo loc bo sung - tat ca AND voi nhau va voi o Search/tab o tren (loc kep). */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" style={{ fontSize: 12, width: 'auto', minWidth: 160 }}
          value={filterTeamLeader} onChange={(e) => setFilterTeamLeader(e.target.value)}>
          <option value="">Tất cả Tổ trưởng</option>
          {teamLeaderOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        {tab === 'invoiced' && (
          <select className="form-select" style={{ fontSize: 12, width: 'auto', minWidth: 170 }}
            value={filterPaymentMethod} onChange={(e) => setFilterPaymentMethod(e.target.value)}>
            <option value="">Tất cả hình thức TT</option>
            <option value="CASH">Tiền mặt</option>
            <option value="TRANSFER">Chuyển khoản</option>
          </select>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gray-600)' }}>
          <span>Tiếp nhận từ</span>
          <input className="form-input" type="date" style={{ fontSize: 12, width: 'auto' }} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          <span>đến</span>
          <input className="form-input" type="date" style={{ fontSize: 12, width: 'auto' }} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
        {(filterTeamLeader || filterPaymentMethod || filterDateFrom || filterDateTo) && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11 }}
            onClick={() => { setFilterTeamLeader(''); setFilterPaymentMethod(''); setFilterDateFrom(''); setFilterDateTo(''); }}
          >
            Xóa lọc
          </button>
        )}
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
              <th>Số RO</th><th>Người tạo</th><th>Khách hàng</th><th>Xe</th><th>Tổ trưởng</th>
              <th>Ngày tiếp nhận</th><th>Tổng tiền</th><th>Trạng thái</th>
              {tab === 'invoiced' && <><th>Hình thức TT</th><th>Thời gian TT</th></>}
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={tab === 'invoiced' ? 11 : 9}>
                <div className="empty-state">
                  <p>Đang tải danh sách phiếu…</p>
                </div>
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={tab === 'invoiced' ? 11 : 9}>
                <div className="empty-state">
                  <h3>Chưa có phiếu quyết toán nào</h3>
                  <p>Không có phiếu nào ở trạng thái này.</p>
                </div>
              </td></tr>
            )}
            {paginated.map((o) => {
              const st = STATUS_LABELS[displayStatus(o)];
              return (
                <tr key={o.id}
                  style={{ background: o.status === 'waiting_payment' ? '#F9FBE7' : undefined, cursor: 'pointer' }}
                  onClick={(e) => {
                    // Handler mousedown o tang document da dong menu truoc do va ghi lai
                    // no vua mo cho dong nao. Bam lai dung dong dang mo = y muon DONG,
                    // nen khong mo lai; bam dong khac thi mo menu cua dong do.
                    const wasOpen = menuOpenBeforeClickRef.current;
                    menuOpenBeforeClickRef.current = null;
                    if (wasOpen === o.id) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                    setMenuOpenId(o.id);
                  }}>
                  {menuOpenId === o.id && menuRect && createPortal(
                    // Khong con lop phu chan click - viec dong menu do handler mousedown
                    // o tang document lo (xem useEffect ben tren), nho vay cu bam van
                    // toi duoc nut/dong ben duoi.
                    <div data-row-menu
                      style={{ position: 'fixed', top: menuRect.top, right: menuRect.right, background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 1000, minWidth: 180 }}>
                      <div onMouseDown={() => { setMenuOpenId(null); setMenuRect(null); handleAccessSettlement(o); }}
                        style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)', whiteSpace: 'nowrap' }}>
                        Truy cập phiếu
                      </div>
                      <div onMouseDown={() => { setMenuOpenId(null); setMenuRect(null); handleOpenActivityLog(o); }}
                        style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                        Nhật ký hoạt động phiếu
                      </div>
                    </div>,
                    document.body
                  )}
                  <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{o.code}</span></td>
                  <td style={{ fontSize: 12 }}>{o.advisor || <span style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>—</span>}</td>
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
                  <td>
                    <span className={`badge ${st?.badge}`}>{st?.label}</span>
                    {o.lockedByName && (
                      <div style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 3, fontStyle: 'italic' }}>
                        Đang mở: {o.lockedByName}{o.lockedAt ? ` lúc ${o.lockedAt.slice(-5)}` : ''}
                      </div>
                    )}
                  </td>
                  {tab === 'invoiced' && (
                    <>
                      <td style={{ fontSize: 12 }}>
                        {o.paymentMethod === 'CASH' ? 'Tiền mặt' : o.paymentMethod === 'TRANSFER' ? 'Chuyển khoản' : '—'}
                      </td>
                      <td style={{ fontSize: 12 }}>{o.paidDate || '—'}</td>
                    </>
                  )}
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      {o.status === 'waiting_repair' && (
                        <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => setCancelTarget({ kind: 'settlement', id: o.id, code: o.code })}>Hủy</button>
                      )}

                      {o.status === 'inprogress' && o.repairOrderId && !o.hasCompletedTask && (
                        <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => setCancelTarget({ kind: 'repair_order', id: o.id, code: o.code })}>Hủy</button>
                      )}

                      {o.status === 'waiting_payment' && (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11, background: '#2E7D32', borderColor: '#2E7D32' }}
                          onClick={() => handlePreview(o)}>
                          In phiếu và xuất hóa đơn
                        </button>
                      )}

                      {/* "Chinh sua" da chuyen vao trong modal "Truy cap phieu"
                          (xem DetailModal) - de thao tac sua phieu luon di qua
                          buoc mo phieu, tranh 2 nguoi cung sua ma khong ai biet
                          (khoa "dang mo phieu" chi duoc dat khi truy cap phieu). */}
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

      {view && (
        <DetailModal
          order={view}
          onClose={() => { releaseLockIfHeld(); setView(null); }}
          onPreview={setPreviewOrder}
          canEdit={canManage && view.status !== 'invoiced' && view.status !== 'waiting_payment' && view.status !== 'cancelled'}
          // Nha khoa "dang mo phieu" truoc khi roi sang trang Chinh sua - trang
          // do khong gui nhip gia han khoa, giu lai se thanh khoa "ma" treo den
          // khi het han (xem LOCK_TTL_SECONDS ben BE).
          //
          // KHONG truyen state={{ order: view }} - dong lay tu danh sach KHONG
          // co items day du (xem fetchFullOrder), truyen thang vao se lam form
          // luu ghi de mat het hang muc cua phieu. De trang Chinh sua tu goi
          // getRepairSettlementApi(id) lay ban day du.
          onEdit={() => {
            releaseLockIfHeld();
            setView(null);
            navigate(`/repair-settlement/edit/${view.id}`);
          }}
        />
      )}

      {activityLogFor && (
        <ActivityLogModal
          order={activityLogFor}
          onClose={() => setActivityLogFor(null)}
        />
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
            ? `Hủy phiếu quyết toán ${cancelTarget.code} (đang sửa chữa - tổ đang làm sẽ dừng ngay)`
            : `Hủy phiếu quyết toán ${cancelTarget.code}`}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Modal "Nhật ký hoạt động phiếu" - hien lai cac buoc (tao/truy cap/sua/
// doi trang thai/in...) cua 1 phieu, ai lam luc nao. Tai su dung dung audit
// log dang "lifecycle" da co san o BE (1 dong/1 phieu, xem
// RepairSettlementService.getActivityLog), khong tao nguon du lieu rieng ──
// Hien 1 gia tri truoc/sau trong bang so sanh - trong/null hien "(trống)" de
// phan biet voi chuoi rong that su, khong dung formatCurrency o day vi ap
// dung chung cho ca so km/CK%/chuoi (chi rieng unitPrice moi format tien te,
// xem renderChangeLine).
function formatDiffValue(v) {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  return String(v);
}

// "Bản ghi so sánh" cho 1 buoc "Cập nhật nội dung phiếu" - liet ke tung thay
// doi cu the (truoc -> sau) thay vi chi 1 dong mo ta chung chung, de phieu
// nhieu hang muc van biet ro sua CAI GI (xem RepairSettlementService
// .diffSettlementForActivityLog o BE, noi tinh ra mang changes nay).
function ChangesList({ changes }) {
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {changes.map((c, i) => {
        if (c.type === 'field') {
          return (
            <div key={i} style={{ fontSize: 12, color: 'var(--gray-700)' }}>
              <b>{c.label}:</b> {formatDiffValue(c.before)} → {formatDiffValue(c.after)}
            </div>
          );
        }
        if (c.type === 'item_added') {
          return (
            <div key={i} style={{ fontSize: 12, color: '#2E7D32' }}>
              + Thêm: {c.label} ({c.qty} × {formatCurrency(c.unitPrice)})
            </div>
          );
        }
        if (c.type === 'item_removed') {
          return (
            <div key={i} style={{ fontSize: 12, color: '#C62828' }}>
              − Xóa: {c.label} ({c.qty} × {formatCurrency(c.unitPrice)})
            </div>
          );
        }
        if (c.type === 'item_changed') {
          return (
            <div key={i} style={{ fontSize: 12, color: '#B45309' }}>
              <div>± Sửa: {c.label}</div>
              <div style={{ marginLeft: 12 }}>
                {(c.fields || []).map((f, j) => (
                  <div key={j}>
                    {f.label}: {f.key === 'unitPrice' ? formatCurrency(f.before) : formatDiffValue(f.before)}
                    {' → '}
                    {f.key === 'unitPrice' ? formatCurrency(f.after) : formatDiffValue(f.after)}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function ActivityLogModal({ order, onClose }) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getSettlementActivityLogApi(order.id)
      .then((data) => { if (!cancelled) setSteps(data?.steps || []); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Không tải được nhật ký hoạt động'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [order.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 className="modal-title">Nhật ký hoạt động — {order.code}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Đang tải…</p>}
          {!loading && error && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
          {!loading && !error && steps.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Chưa có hoạt động nào được ghi nhận.</p>
          )}
          {!loading && !error && steps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {[...steps].reverse().map((s, i) => {
                const at = s.at ? new Date(s.at) : null;
                return (
                  <div key={i} style={{ borderLeft: '3px solid var(--primary)', paddingLeft: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label || s.step}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                      {s.by || 'Hệ thống'}{at && !Number.isNaN(at.getTime()) ? ` · ${at.toLocaleString('vi-VN')}` : ''}
                    </div>
                    {Array.isArray(s.changes) && s.changes.length > 0 && <ChangesList changes={s.changes} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal nhap ly do huy phieu - cho phep huy ca khi dang "Cho sua chua"
// lan "Dang sua chua" (BE cascade huy luon lenh sua chua neu da co, xem
// RepairSettlementService.updateStatus) ──
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
  // Chan chon "Ngày mua" xe trong tuong lai (input type=date) - xe khong the
  // mua o mot ngay chua toi.
  const todayInputValue = new Date().toISOString().slice(0, 10);

  const [customerQuery, setCustomerQuery] = useState(existingOrder?.customer?.fullName || '');
  const [plateQuery, setPlateQuery] = useState(existingOrder?.vehicle?.licensePlate || '');
  const [activeField, setActiveField] = useState(null); // 'customer' | 'plate' | 'frame' | 'engine' | 'phone'
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // true khi thông tin khách hàng đến từ tra cứu DB có sẵn -> che phone/email/cccd khi hiển thị
  const [isFromLookup, setIsFromLookup] = useState(Boolean(existingOrder?.customer?.phone));
  const searchSeq = useRef(0);

  // Fallback contactPerson/contactPhone ve fullName/phone cua khach hang khi
  // customer chua tung nhap rieng nguoi lien he - dong bo voi selectSuggestion
  // ben duoi (luc CVDV tra cuu chon khach hang co san luc TAO moi), tranh 2
  // duong nap du lieu (tao moi vs sua) cho ra ket qua khac nhau.
  const [customerInfo, setCustomerInfo] = useState(() => {
    const c = existingOrder?.customer;
    if (!c) return { fullName: '', address: '', phone: '', taxCode: '', cccd: '', email: '', contactPerson: '', contactPhone: '' };
    return { ...c, contactPerson: c.contactPerson || c.fullName || '', contactPhone: c.contactPhone || c.phone || '' };
  });
  const [vehicleInfo, setVehicleInfo] = useState(() => {
    const base = existingOrder?.vehicle || {
      licensePlate: '', vehicleModel: '', frameNumber: '', engineNumber: '', purchaseDate: '', currentKm: '',
      warrantyEndDate: '', warrantyKmLimit: null, modelId: null,
    };
    // Km luc mo trang (man Sua) - dung lam moc doi chieu canh bao neu CVDV
    // sua currentKm xuong THAP HON, xem handleSave.
    return { ...base, lastKnownKm: base.currentKm || null };
  });
  // Catalog dong+doi xe that (vehicle_models) - de o "Loai xe" chon dung tu
  // danh sach that (gan duoc model_id) thay vi go tu do khong lien ket duoc
  // voi catalog. Chi vai chuc dong nen tai het 1 lan, loc ngay tren FE.
  const [vehicleModels, setVehicleModels] = useState([]);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  // Tu khoa tim kiem trong o "Loai xe" - TACH RIENG khoi vehicleInfo.vehicleModel
  // (gia tri that). Go vao day khong lam thay doi loai xe da chon.
  const [modelQuery, setModelQuery] = useState('');
  // Dong/mo 3 khung chinh cua form. Mac dinh mo het; chi la trang thai hien
  // thi nen khong can luu lai giua cac lan mo form.
  const [openSections, setOpenSections] = useState({ customer: true, intake: true, items: true });
  const toggleSection = (key) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));
  useEffect(() => {
    if (isEdit) return;
    listVehicleModelsApi().then(setVehicleModels).catch(() => {});
  }, [isEdit]);
  // O "Loai xe" la DANH SACH CHON, khong cho go tay: chu go vao chi de LOC
  // (modelQuery), khong bao gio tro thanh gia tri. Truoc day go tay duoc nen
  // CVDV luu duoc 1 loai xe khong co trong catalog (modelId = null) - xe do
  // sau nay khong loc duoc goi bao duong theo doi xe, va khong tra ra dung
  // phu tung/dinh muc. Xem them ensureMaintenancePackageMeta.js.
  //
  // Bo trong o tim kiem -> hien TOAN BO danh sach (khong cat 8 dong nhu truoc,
  // catalog chi hon chuc dong nen cuon thoai mai).
  const modelSuggestions = (() => {
    const term = modelQuery.trim().toLowerCase();
    if (!term) return vehicleModels;
    return vehicleModels.filter((m) => (
      m.displayName.toLowerCase().includes(term)
      || (m.modelLine || '').toLowerCase().includes(term)
      || (m.trimName || '').toLowerCase().includes(term)
    ));
  })();

  const [customerRequest, setCustomerRequest] = useState(existingOrder?.customerRequest || '');
  const [intakeChecklist, setIntakeChecklist] = useState(existingOrder?.intakeChecklist || DEFAULT_INTAKE_CHECKLIST);

  // Chu ky dien tu tai cho - bat buoc luc tao phieu moi (khong ap dung khi sua
  // phieu da co, chu ky goc khong doi lai). signerName auto-fill theo nguoi
  // lien he - phai dong bo lai moi khi customerInfo doi (vd sau khi CVDV tra
  // cuu/chon khach hang, KHONG chi luc mount form vi luc do chua chon khach),
  // nhung ngung auto-fill ngay khi CVDV tu tay sua ten nguoi ky.
  const signaturePadRef = useRef(null);
  const [signerName, setSignerName] = useState(existingOrder?.signerName || '');
  const signerNameEditedRef = useRef(Boolean(existingOrder?.signerName));
  useEffect(() => {
    if (!signerNameEditedRef.current) {
      setSignerName(customerInfo.contactPerson || customerInfo.fullName || '');
    }
  }, [customerInfo.contactPerson, customerInfo.fullName]);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  // Bo dem chung sinh groupId - dung ca luc tai du lieu cu (assignGroupIds)
  // lan luc chon dich vu/goi moi trong phien lam viec nay (xem selectCatalog*).
  const catalogGroupSeq = useRef(0);
  const nextGroupId = () => ++catalogGroupSeq.current;
  // originalQty = so luong da LUU tu lan truoc (chi dong da co san khi mo
  // man Chinh sua, dong moi them trong phien nay khong co) - dung de: (1)
  // chi cho GIAM so luong phu tung (khach hoan tra hang/huy bot), khong cho
  // tang truc tiep qua o so luong nay - muon dung THEM phai them dong moi
  // qua "Thêm phụ tùng"/chon lai tu catalog; (2) hien chu thich "(Khách hoàn
  // trả hàng)" khi da giam - xem handleGroupQtyChange/isQuantityReturned.
  const [items, setItems] = useState(() => assignGroupIds(
    existingOrder?.items?.length
      ? existingOrder.items.map((it) => ({ ...it, originalQty: it.qty }))
      : [emptyItem()],
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

  // Tien do (tasks/thợ/khoang/status) cua lenh sua chua - tach RIENG khoi
  // existingOrder (prop bat dong, chi nap 1 lan luc mount) vi to
  // truong/tho co the tick/hoan thanh NGAY LUC CVDV dang mo trang nay -
  // phai nap lai realtime, khong thi cac kiem tra "da hoan thanh chua"
  // (canOfferCancel/canRemoveGroup) se dung du lieu cu, cho phep Huy/Xoa
  // nham 1 hang muc vua duoc tick that ra ngoai doi. status cung phai theo
  // doi realtime (khong chi tasks/thợ/khoang) - to truong/tho co the vua
  // tick xong dau muc CUOI CUNG va lenh tu chuyen "Cho thanh toan" (xem
  // RepairOrderRepositoryImpl.updateStatus) NGAY luc CVDV dang mo san man
  // Chinh sua nay - phai khoa form lai ngay, khong thi CVDV van bam Luu duoc
  // (BE tu 08/2026 da chan roi nhung FE nen khoa som, khong doi loi 409).
  const [liveOrderInfo, setLiveOrderInfo] = useState({
    tasks: existingOrder?.tasks || [],
    technicians: existingOrder?.technicians || [],
    bayNumber: existingOrder?.bayNumber || null,
    status: existingOrder?.status || null,
  });
  const refreshLiveOrderInfo = useCallback(() => {
    if (!isEdit || !existingOrder?.id) return;
    getRepairSettlementApi(existingOrder.id)
      .then((o) => setLiveOrderInfo({ tasks: o.tasks || [], technicians: o.technicians || [], bayNumber: o.bayNumber || null, status: o.status || null }))
      .catch(() => {});
  }, [isEdit, existingOrder?.id]);
  useEffect(() => {
    if (!isEdit) return undefined;
    const intervalId = setInterval(refreshLiveOrderInfo, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isEdit, refreshLiveOrderInfo]);
  const handleOrderInfoSSE = useCallback((event) => {
    if (!existingOrder?.repairOrderId) return;
    if (event.type === 'task-updated' && Number(event.orderId) === Number(existingOrder.repairOrderId)) {
      refreshLiveOrderInfo();
    }
    // 'order-completed': to truong bam Hoan thanh lenh sua chua -> phieu
    // quyet toan tu chuyen "waiting_payment" (xem RepairOrderService.updateStatus).
    // Phai nap lai NGAY (khong doi 15s poll) de khoa form kip thoi.
    if (event.type === 'order-completed' && Number(event.orderId) === Number(existingOrder.repairOrderId)) {
      refreshLiveOrderInfo();
    }
  }, [existingOrder?.repairOrderId, refreshLiveOrderInfo]);
  useRepairOrderEventsSSE(handleOrderInfoSSE, isEdit);

  // Phieu da roi khoi trang thai cho sua ("waiting_repair"/"inprogress") o
  // NOI KHAC (to truong hoan thanh lenh, hoac CVDV khac huy/xuat hoa don)
  // trong luc man Chinh sua nay van dang mo - khong the sua tiep duoc nua,
  // xem comment liveOrderInfo o tren. Vua luu thanh cong trong phien nay
  // (savedOrder, chua bam "Chinh sua lai phieu") cung khoa form tuong tu.
  const closedElsewhere = isEdit && Boolean(liveOrderInfo.status)
    && liveOrderInfo.status !== 'waiting_repair' && liveOrderInfo.status !== 'inprogress';
  // khoa toan bo form lai, tranh go them ma khong con nut Luu nao de bam nua
  // (xem fieldset disabled ben duoi va nut trong Tong ket thanh toan).
  const locked = Boolean(savedOrder) || closedElsewhere;

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
          // Gói bảo dưỡng được khai báo riêng cho TỪNG đời xe (72 gói = 12 đời
          // x 6 cấp) nên chỉ gợi ý gói của đúng chiếc xe đang lập phiếu - trước
          // đây hiện cả 72 gói nên chọn nhầm gói CX-5 cho xe Mazda2 vẫn lưu
          // được. Xe cũ chưa gán được đời trong catalog (modelId rỗng) thì vẫn
          // hiện đủ, không chặn cố vấn lập phiếu.
          const packages = vehicleInfo.modelId
            ? (result.packages || []).filter((p) => !p.modelId || String(p.modelId) === String(vehicleInfo.modelId))
            : (result.packages || []);
          if (seq === catalogSearchSeq.current) setCatalogSuggestions((prev) => ({ ...prev, [idx]: { type: 'catalog', ...result, packages } }));
        }
      } catch {
        if (seq === catalogSearchSeq.current) setCatalogSuggestions((prev) => ({ ...prev, [idx]: null }));
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCatalogIdx, items[activeCatalogIdx]?.description, items[activeCatalogIdx]?.lhsc, vehicleInfo.modelId]);

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
      // Doi xe that trong catalog - de o "Hang muc" chi goi y dung goi bao
      // duong cua chiec xe nay (xem effect tra cuu catalog o tren).
      modelId: row.modelId ?? null,
      // Km lan ghi nhan gan nhat (khong hien len o) - chi de doi chieu canh
      // bao neu CVDV nhap so km MOI thap hon, xem handleSave.
      lastKnownKm: row.currentKm ?? null,
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
    setVehicleInfo({ licensePlate: '', vehicleModel: '', frameNumber: '', engineNumber: '', purchaseDate: '', currentKm: '', warrantyEndDate: '', warrantyKmLimit: null, modelId: null, lastKnownKm: null });
    setModelQuery('');
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

  // Dong PT (phu tung) nay dang "di kem" dich vu con nao trong cung nhom -
  // luc chen (selectCatalogPackage/selectCatalogService) da chen NGAY SAU
  // dung dich vu tao ra no, nen chi can lui ve dong DV gan nhat CUNG groupId.
  // Tra ve -1 neu khong tim thay (phu tung roi, tu them tay qua "Thêm phụ tùng").
  function findOwningServiceIdx(arr, partIdx) {
    const groupId = arr[partIdx]?.groupId;
    if (!groupId) return -1;
    for (let j = partIdx - 1; j >= 0; j -= 1) {
      if (arr[j].groupId !== groupId) return -1;
      if (arr[j].lhsc === 'DV') return j;
    }
    return -1;
  }

  // Task (dau muc trong "Tien do cong viec") ung voi dong nay - khop dung
  // key ma BE dung de dong bo checklist khi luu (xem repairOrderTaskBuilder
  // .js computeDesiredTasks): (taskType, taskName=description, productId).
  // Dich vu con nam trong 1 goi combo con nguyen (chua vo) cung khop dung vi
  // task cua no duoc BE sinh tu ten dich vu trong catalog, giong het
  // description da luu tren dong (xem selectCatalogPackage).
  function findTaskForItem(tasks, item) {
    const taskType = item.lhsc === 'PT' ? 'product' : 'service';
    const productId = taskType === 'product' ? (item.productId ?? null) : null;
    return (tasks || []).find((t) => t.taskType === taskType && t.taskName === item.description && (t.productId ?? null) === productId);
  }

  // Dong nay (hoac, neu la dau goi combo, BAT KY dich vu con nao trong no) da
  // duoc tick hoan thanh chua - dung de khoa lua chon "Khách hủy" (dau goi
  // khong co task rieng, phai gop tu cac dich vu con - xem repairOrderTaskBuilder.js).
  function isItemOrGroupDone(item, arr, tasks) {
    if (!tasks || tasks.length === 0) return false;
    const isPackageHead = item.isGroupParent && item.lhsc === 'DV' && !item.serviceId && Boolean(item.groupId);
    if (isPackageHead) {
      return arr.some((it) => it.groupId === item.groupId && it.lhsc === 'DV' && !it.isGroupParent && findTaskForItem(tasks, it)?.isDone);
    }
    return Boolean(findTaskForItem(tasks, item)?.isDone);
  }

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

  // Chi cho chon "Khách hủy" khi: dang o man Chinh sua phieu "dang sua chua"
  // (co lenh sua chua/tasks that de doi chieu), VA hang muc (hoac ca goi neu
  // la dau goi) CHUA duoc tick hoan thanh, VA chua bi huy tu truoc.
  const canOfferCancel = (item) => {
    if (!isEdit || existingOrder?.status !== 'inprogress') return false;
    if (item.httt === HTTT_CANCELLED_VALUE) return false;
    return !isItemOrGroupDone(item, items, liveOrderInfo.tasks);
  };

  // Nut "Xoa" (xoa han khoi phieu, khong de lai vet gi) chi cho phep voi
  // dong CHUA TUNG duoc luu lan nao (item.id rong - vua them trong phien
  // dang sua nay, chua bam Luu) - xoa luc nay an toan vi chua tung ton tai
  // thanh 1 ban ghi that. Dong DA CO id (tuc da it nhat 1 lan duoc luu thanh
  // cong, xem handleSave nap lai items tu result.items sau moi lan Luu) thi
  // coi nhu da la 1 ban ghi chinh thuc trong he thong - bat buoc phai di qua
  // "Huy" (giu lai lam ho so, van tinh tien cong da lam neu co) thay vi xoa
  // trang, KE CA khi dong do van chua co viec lam gi (chua tick hoan thanh).
  // NGOAI LE: phieu con o "Chờ sửa chữa" thi chua ai nhan viec - chua co lenh
  // sua chua, chua sinh dau muc nao ben To truong, khong tho nao nhin thay
  // hang muc nay. Xoa han luc do an toan y het luc dang tao phieu, khong co gi
  // de "giu lam ho so".
  //
  // Truoc day chan cung theo item.id nen sua 1 phieu "Chờ sửa chữa" khong con
  // duong nao bo bot hang muc: nut "Xóa" bi an vi dong da co id, con nut "Hủy"
  // lai chi hien khi phieu DA sang "Đang sửa chữa" (xem canOfferCancel) - o
  // truong hop nay 2 dieu kien loai tru nhau, o thao tac trong tron.
  const notStartedYet = !isEdit || existingOrder?.status === 'waiting_repair';

  const canRemoveGroup = (item) => {
    if (item.id && !notStartedYet) return false;
    if (item.httt === HTTT_CANCELLED_VALUE) return false;
    if (item.lhsc !== 'DV' || !item.isGroupParent || !item.groupId) return true;
    return !isItemOrGroupDone(item, items, liveOrderInfo.tasks);
  };

  // Huy 1 hang muc giua chung - 3 truong hop:
  // 1) Dau goi combo (chua dich vu con nao lam) -> huy CA GOI, ca nhom (dich
  //    vu con + phu tung) chuyen "Khách hủy" theo.
  // 2) Dich vu con NAM TRONG 1 goi combo con nguyen -> "vo goi" (xem
  //    breakApartCombo): tach rieng, lo gia le cho cac dich vu con khac.
  // 3) Dich vu le (khong phai combo, hoac phu tung doc lap) -> huy don gian,
  //    phu tung di kem no (cung nhom, dung ngay sau) huy theo.
  const handleCancelItem = (idx) => {
    const target = items[idx];
    if (!target) return;
    const isPackageHead = target.isGroupParent && target.lhsc === 'DV' && !target.serviceId && Boolean(target.groupId);
    const isComboChildService = isChildRow(target) && target.lhsc === 'DV';

    if (isComboChildService) {
      breakApartCombo(target.groupId, idx);
      return;
    }

    setItems((prev) => {
      // Huy tu (khong lam nua/chua dung toi) -> so luong ve 0 luon, khop dung
      // thuc te "chua tung xuat kho/chua lam" (khac voi "Khách hoàn trả
      // hàng" - truong hop DA dung mot phan roi tra lai bot).
      if (isPackageHead) {
        return prev.map((it) => (it.groupId === target.groupId ? recalcItem({ ...it, httt: HTTT_CANCELLED_VALUE, qty: 0 }) : it));
      }
      const next = prev.map((it, i) => (i === idx ? recalcItem({ ...it, httt: HTTT_CANCELLED_VALUE, qty: 0 }) : it));
      if (target.lhsc === 'DV' && target.groupId) {
        for (let j = idx + 1; j < next.length && next[j].groupId === target.groupId && next[j].lhsc === 'PT'; j += 1) {
          next[j] = recalcItem({ ...next[j], httt: HTTT_CANCELLED_VALUE, qty: 0 });
        }
      }
      return next;
    });
  };

  // "Vo goi": huy rieng 1 dich vu con giua 1 goi combo con nguyen. Dich vu bi
  // huy (+ phu tung di kem no) chuyen "Khách hủy"; cac dich vu con CON LAI
  // (ke ca da tick hoan thanh) lo gia le THAT (tra lai catalog dung theo ma
  // goi - dong dang luu unitPrice=0 vi gop trong gia goi, can gia goc tung
  // dich vu rieng); dong dau goi (gia tron goi) bi xoa vi khong con y nghia
  // mot khi gia da tach rieng tung dich vu - moi dich vu con (ke ca dich vu
  // bi huy) tro thanh 1 nhom doc lap moi (groupId rieng, isGroupParent),
  // hanh xu y het 1 dich vu le duoc chon rieng.
  //
  // Phu tung nao "di kem" dich vu nao XAC DINH QUA DINH MUC THAT trong
  // catalog (pkg.items[].parts[].productId), KHONG dua vao vi tri dong ke
  // nhau trong bang - vi phieu tao TRUOC khi doi sang chen xen ke (hoac loi
  // xay ra khac) van con luu phu tung gop chung o cuoi, vi tri khong dang tin.
  // findOwningServiceIdx (vi tri) chi con la fallback khi phu tung khong con
  // trong dinh muc catalog nua (hiem, vd danh muc da doi sau khi tao phieu).
  const breakApartCombo = async (groupId, cancelledIdx) => {
    const headRow = items.find((it) => it.groupId === groupId && it.isGroupParent);
    if (!headRow) return;

    let priceByServiceId = new Map();
    let serviceIdByProductId = new Map();
    try {
      const result = await searchCatalogApi(headRow.code);
      const pkg = (result.packages || []).find((p) => p.code === headRow.code);
      if (pkg) {
        priceByServiceId = new Map(pkg.items.map((it) => [String(it.serviceId), it.unitPrice]));
        for (const svc of pkg.items) {
          for (const part of svc.parts || []) {
            serviceIdByProductId.set(String(part.productId), String(svc.serviceId));
          }
        }
      }
    } catch {
      /* Tra catalog loi - cac dich vu con con lai tam giu gia 0, co van tu sua tay sau. */
    }

    setItems((prev) => {
      const groupIdxSet = new Set(prev.map((it, i) => (it.groupId === groupId ? i : -1)).filter((i) => i !== -1));
      if (!groupIdxSet.has(cancelledIdx)) return prev; // du lieu da doi khac trong luc cho tra catalog

      const sortedGroupIdxs = [...groupIdxSet].sort((a, b) => a - b);
      const newGroupIdByOwnerIdx = new Map(); // idx dich vu con (trong prev cu) -> groupId rieng moi
      const idxByServiceId = new Map(); // serviceId dich vu con -> idx (trong prev) - de tra tu productId ra dung idx
      for (const i of sortedGroupIdxs) {
        const it = prev[i];
        if (it.lhsc === 'DV' && !it.isGroupParent && it.serviceId != null) idxByServiceId.set(String(it.serviceId), i);
      }

      const replacement = [];
      for (const i of sortedGroupIdxs) {
        const it = prev[i];
        if (it.isGroupParent) continue; // bo dong dau goi

        if (it.lhsc === 'DV') {
          const newGid = nextGroupId();
          newGroupIdByOwnerIdx.set(i, newGid);
          if (i === cancelledIdx) {
            // Huy tu (chua lam) -> so luong ve 0 luon.
            replacement.push(recalcItem({ ...it, httt: HTTT_CANCELLED_VALUE, qty: 0, groupId: newGid, isGroupParent: true }));
          } else {
            const price = priceByServiceId.get(String(it.serviceId));
            replacement.push(recalcItem({ ...it, unitPrice: price != null ? price : it.unitPrice, groupId: newGid, isGroupParent: true }));
          }
          continue;
        }

        // Phu tung - uu tien tra dung dich vu so huu qua dinh muc catalog
        // (productId), chi lui ve doan vi tri ke nhau neu khong tim thay
        // (fallback cho truong hop hiem catalog da doi/thieu du lieu).
        const ownerServiceId = serviceIdByProductId.get(String(it.productId));
        const ownerIdx = ownerServiceId != null && idxByServiceId.has(ownerServiceId)
          ? idxByServiceId.get(ownerServiceId)
          : findOwningServiceIdx(prev, i);
        const ownerNewGid = newGroupIdByOwnerIdx.get(ownerIdx);
        const cancelled = ownerIdx === cancelledIdx;
        replacement.push(recalcItem({ ...it, groupId: ownerNewGid ?? it.groupId, httt: cancelled ? HTTT_CANCELLED_VALUE : it.httt, qty: cancelled ? 0 : it.qty }));
      }

      const result = [];
      let inserted = false;
      prev.forEach((it, i) => {
        if (groupIdxSet.has(i)) {
          if (!inserted) {
            result.push(...replacement);
            inserted = true;
          }
          return;
        }
        result.push(it);
      });
      return result;
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
      let newQty = isEmpty || Number.isNaN(parsed) ? '' : parsed;
      // Phu tung DA TUNG LUU (originalQty) chi duoc GIAM (khach hoan tra
      // hang/dung it hon du kien), khong cho tang truc tiep qua o nay vuot
      // qua so da tung dat ban dau - muon dung THEM phai them 1 dong moi
      // (qua "Thêm phụ tùng"/chon lai tu catalog), khong sua thang dong cu.
      if (target.lhsc === 'PT' && typeof newQty === 'number' && target.originalQty != null && newQty > target.originalQty) {
        newQty = target.originalQty;
      }
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
            const scaled = recalcItem({ ...next[j], qty: scaledQty });
            // Phu tung nay vua duoc co gian THEO dich vu cha (khong phai tu
            // tay sua rieng dong nay) - coi scaledQty la moc "da tung dat"
            // MOI, cho giam tiep tu day binh thuong o lan sua sau, thay vi
            // van bi ep ve moc originalQty CU (tu truoc khi co gian) khien
            // giam 1 nac nhay thang ve moc cu roi ve 0.
            if (scaled.lhsc === 'PT' && scaled.originalQty != null) {
              scaled.originalQty = scaledQty;
            }
            next[j] = scaled;
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
    if (!canRemoveGroup(target)) return prev;
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
      // note: giu lai ghi chu CVDV da go tren dong nay TRUOC khi tra cuu/chon
      // dich vu (vd go "Lưu ý cho thợ..." roi moi go ten dich vu de tim trong
      // catalog) - truoc day spread ...emptyItem() lam mat trang ghi chu nay,
      // trong khi selectCatalogPackage/selectProduct (2 duong chon catalog
      // con lai) da spread dung tu dong hien co nen khong bi mat.
      const newHead = recalcItem({ ...emptyItem(), note: prev[idx]?.note || '', code: svc.code, serviceId: svc.id, productId: null, description: svc.name, unitPrice: svc.unitPrice, unit: 'Công', lhsc: 'DV', httt: 'KHT', discount: 0, repairCategory, groupId, isGroupParent: true });
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
  // gói rồi). Phụ tùng của MỖI dịch vụ con chèn NGAY SAU dịch vụ đó (không
  // gộp chung 1 cục ở cuối như trước) - để biết đúng phụ tùng nào "đi kèm"
  // dịch vụ con nào, phục vụ tình huống hủy riêng 1 dịch vụ con giữa chừng
  // (xem findOwningServiceIdx/handleCancelItem) - có thể trùng phụ tùng
  // giữa 2 dịch vụ con (mỗi dịch vụ giữ dòng riêng), chấp nhận đánh đổi này.
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
      const rows = [];
      for (const it of pkg.items) {
        rows.push(recalcItem({
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
          // Yêu cầu thực hiện của cấp bảo dưỡng này (Thay thế / Kiểm tra...) -
          // chỉ để hiển thị, không lưu xuống repair_order_items (BE tự tra lại
          // từ catalog khi sinh checklist cho tổ trưởng, xem
          // repairOrderTaskBuilder.js).
          actionCode: it.actionCode || null,
        }));
        // Chỉ đầu mục PHẢI THAY mới kèm sẵn phụ tùng. Đầu mục kiểm tra (I/M/V)
        // theo biểu mẫu chỉ "thay nếu cần thiết" - kèm sẵn phụ tùng cho cả 30
        // đầu mục như trước là xuất kho thừa và đội tiền của khách; khi thợ
        // xác định cần thay thật thì cố vấn thêm dòng phụ tùng sau (dòng thêm
        // sau được đánh dấu "(Khách thêm)", xem _syncRepairOrderTasks).
        if (consumesPart(it.actionCode)) {
          rows.push(...buildPartRows(it.parts, repairCategory).map((r) => ({ ...r, groupId })));
        }
      }
      next.splice(idx + 1, 0, ...rows);
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
  const signatureDate = new Date();

  // Neu chon tu goi y tra cuu (co id that trong DB) thi luon du dieu kien Luu.
  // Neu KHONG chon tu tra cuu (khach hang/xe hoan toan moi, chi luc TAO phieu
  // moi) - van cho Luu binh thuong, khong bat buoc phai co san trong DB nua:
  // BE se tu tim-hoac-tao khach hang (theo SDT) va xe (theo bien so) that,
  // xem RepairSettlementService._resolveCustomerAndVehicle - chi can du cac o
  // bat buoc toi thieu de tao duoc 1 ban ghi hop le.
  const canSave = isFromLookup
    ? Boolean(customerInfo.id) && Boolean(vehicleInfo.id)
    : (!isEdit
      && Boolean((customerInfo.fullName || '').trim())
      && Boolean((customerInfo.phone || '').trim())
      && Boolean((vehicleInfo.licensePlate || '').trim())
      // Loai xe BAT BUOC chon tu catalog (modelId), khong con go tay duoc -
      // xe khong gan duoc doi xe thi sau nay khong loc duoc goi bao duong va
      // khong tra dung dinh muc phu tung.
      && Boolean(vehicleInfo.modelId));

  const buildPayload = () => ({
    customerId: customerInfo.id || null,
    vehicleId: vehicleInfo.id || null,
    // Chi thuc su can khi customerId/vehicleId con trong (khach hang/xe MOI,
    // chua chon tu tra cuu) - BE tu tim-hoac-tao that trong DB tu 2 khoi nay,
    // xem RepairSettlementService._resolveCustomerAndVehicle. Gui kem luon ca
    // khi da co id cung khong sao (BE bo qua neu da co id).
    customer: customerInfo,
    vehicle: vehicleInfo,
    customerRequest,
    currentKm: vehicleInfo.currentKm || null,
    items,
    ...totals,
    intakeChecklist,
    signatureData: signaturePadRef.current && !signaturePadRef.current.isEmpty()
      ? signaturePadRef.current.toDataURL()
      : null,
    signerName,
  });

  const handleSave = async () => {
    if (closedElsewhere) {
      setSaveError('Lệnh sửa chữa của phiếu này vừa hoàn thành (hoặc phiếu đã bị hủy/xuất hóa đơn) - không thể lưu chỉnh sửa nữa.');
      return;
    }
    if (!canSave) {
      setSaveError(isFromLookup
        ? 'Vui lòng chọn khách hàng và xe từ gợi ý tra cứu trước khi lưu.'
        : 'Vui lòng nhập đủ tên khách hàng, số điện thoại, biển số xe, hãng xe và tên xe trước khi lưu.');
      return;
    }
    // Khach/xe go tay hoan toan moi (khong qua tra cuu) - cac o nay con sua
    // duoc nen can chan dung dinh dang truoc khi goi API, tranh doi den luc
    // BE tra loi 400 CVDV moi biet sai o dau.
    if (!isFromLookup && !isEdit) {
      if (!isValidPhone(customerInfo.phone)) {
        setSaveError('Số điện thoại khách hàng không hợp lệ.');
        return;
      }
      if (customerInfo.contactPhone?.trim() && !isValidPhone(customerInfo.contactPhone)) {
        setSaveError('Số điện thoại người liên hệ không hợp lệ.');
        return;
      }
      if (customerInfo.email?.trim() && !isValidEmail(customerInfo.email)) {
        setSaveError(EMAIL_HINT);
        return;
      }
      if (customerInfo.cccd?.trim() && !CCCD_REGEX.test(customerInfo.cccd.trim())) {
        setSaveError('Số CCCD/CMND không hợp lệ (phải là 9 hoặc 12 chữ số).');
        return;
      }
    }
    if (vehicleInfo.currentKm === '' || vehicleInfo.currentKm == null) {
      setSaveError('Vui lòng nhập số km hiện tại của xe trước khi lưu.');
      return;
    }
    // Cong-to-met ve nguyen tac chi tang - chan cung, khong cho luu neu so moi
    // nhap thap hon lan ghi nhan gan nhat (hien san "Lần trước: N km" canh o
    // nhap de CVDV tu doi chieu truoc khi go, xem UI o duoi).
    if (vehicleInfo.lastKnownKm != null && Number(vehicleInfo.currentKm) < Number(vehicleInfo.lastKnownKm)) {
      setSaveError(`Số km hiện tại (${Number(vehicleInfo.currentKm).toLocaleString('vi-VN')}) không được nhỏ hơn lần ghi nhận gần nhất (${Number(vehicleInfo.lastKnownKm).toLocaleString('vi-VN')} km).`);
      return;
    }
    if (!customerRequest.trim()) {
      setSaveError('Vui lòng nhập mô tả yêu cầu của khách hàng trước khi lưu.');
      return;
    }
    if (!isEdit && !isIntakeChecklistComplete(intakeChecklist)) {
      setSaveError('Vui lòng hoàn thành tất cả các mục trong Tiếp nhận và bàn giao xe (trừ các ô nhập văn bản) trước khi lưu.');
      return;
    }
    if (!isEdit && signatureEmpty) {
      setSaveError('Vui lòng ký xác nhận trước khi lưu phiếu.');
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
        // BE xoa het + ghi lai toan bo repair_order_items moi lan luu (xem
        // RepairSettlementService.update) nen result.items co id THAT moi -
        // nap lai items local theo id nay. Voi phieu DA sang "Đang sửa chữa",
        // co id nghia la "Xoa" tu dong khoa lai (chi con "Huy") cho MOI dong,
        // ke ca dong vua them trong phien nay; con phieu van o "Chờ sửa chữa"
        // thi van xoa han duoc - xem canRemoveGroup/notStartedYet.
        setItems(assignGroupIds(
          (result.items || []).map((it) => ({ ...it, originalQty: it.qty })),
          nextGroupId
        ));
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

      {locked && (
        <div style={{ background: '#FFF7E6', border: '1px solid #FFE0A3', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#8A6100' }}>
          {closedElsewhere
            ? 'Lệnh sửa chữa của phiếu này vừa hoàn thành (hoặc phiếu đã bị hủy/xuất hóa đơn) - không thể chỉnh sửa nữa. Vui lòng quay lại danh sách.'
            : 'Phiếu đã lưu - đang ở chế độ chỉ xem. Bấm "Chỉnh sửa lại phiếu" nếu muốn sửa thêm.'}
        </div>
      )}

      {/* locked=true (vua luu xong trong phien nay) khoa toan bo vung nhap
          lieu - tranh go them roi tuong da luu nhung thuc ra khong con nut
          Luu nao de bam nua (chi co the sua tiep sau khi bam "Chinh sua lai
          phieu", xem nut trong Tong ket thanh toan ben duoi). disabled tren
          fieldset tu dong lan xuong moi input/select/button/textarea con,
          khong can sua tung o rieng le. */}
      <fieldset disabled={locked} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>

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
      <CollapsibleCard
        title="Thông tin khách hàng & xe"
        open={openSections.customer}
        onToggle={() => toggleSection('customer')}
        summary={(() => {
          // Gap khung lai van phai biet da du thong tin bat buoc chua - o
          // "Yeu cau cua khach hang" nam trong khung nay, khuat di rat de
          // bam Luu hut roi khong hieu vi sao nut bi khoa.
          const daNhap = [customerInfo.fullName, vehicleInfo.licensePlate, vehicleInfo.vehicleModel]
            .filter(Boolean).join(' · ');
          const thieu = !canSave || !(customerRequest || '').trim();
          return `${daNhap || 'Chưa nhập'}${thieu ? ' — ⚠ còn thiếu thông tin bắt buộc' : ''}`;
        })()}
        actions={isFromLookup && !isEdit && (
          <button className="btn btn-secondary btn-sm" onClick={resetLookup}>Chọn lại khách hàng</button>
        )}
      >
        <div>
          <div className="form-grid form-grid-2">
            <div>
              <div className="form-group" style={{ position: 'relative', marginBottom: 12 }}>
                <label className="form-label required">Tên khách hàng</label>
                <input className="form-input"
                  value={customerQuery}
                  readOnly={isFromLookup || isEdit}
                  onChange={(e) => { setCustomerQuery(e.target.value); cInfoSet('fullName', e.target.value); setIsFromLookup(false); setActiveField('customer'); setShowSuggestions(true); }}
                  onFocus={() => { if (!isFromLookup && !isEdit) { setActiveField('customer'); setShowSuggestions(true); } }}
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
                <input className="form-input" value={customerInfo.address} readOnly={isFromLookup || isEdit} onChange={(e) => cInfoSet('address', e.target.value)} placeholder="Địa chỉ khách hàng" />
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label required">Điện thoại</label>
                  <input className="form-input"
                    value={customerInfo.phone}
                    readOnly={isFromLookup || isEdit}
                    onChange={(e) => { cInfoSet('phone', e.target.value); setIsFromLookup(false); setActiveField('phone'); setShowSuggestions(true); }}
                    onFocus={() => { if (!isFromLookup && !isEdit) { setActiveField('phone'); setShowSuggestions(true); } }}
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
                  <input className="form-input" value={customerInfo.taxCode} readOnly={isFromLookup || isEdit} onChange={(e) => cInfoSet('taxCode', e.target.value)} placeholder="Mã số thuế" />
                </div>
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">CCCD</label>
                  <input className="form-input"
                    value={customerInfo.cccd}
                    readOnly={isFromLookup || isEdit}
                    onChange={(e) => { cInfoSet('cccd', e.target.value); setIsFromLookup(false); }}
                    placeholder="Số CCCD / CMND" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input"
                    value={customerInfo.email}
                    readOnly={isFromLookup || isEdit}
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
                  readOnly={isFromLookup || isEdit}
                  onChange={(e) => { setPlateQuery(e.target.value); vInfoSet('licensePlate', e.target.value); setIsFromLookup(false); setActiveField('plate'); setShowSuggestions(true); }}
                  onFocus={() => { if (!isFromLookup && !isEdit) { setActiveField('plate'); setShowSuggestions(true); } }}
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

              <div className="form-group" style={{ position: 'relative', marginBottom: 12 }}>
                <label className={`form-label${!isFromLookup && !isEdit ? ' required' : ''}`}>Loại xe</label>
                {/* Danh sach chon, KHONG go tay duoc: o input chi de tim kiem.
                    Dang mo -> hien tu khoa dang go; dong lai -> hien loai xe da
                    chon. Muon doi thi bam vao o (tu xoa tu khoa, mo lai danh
                    sach) hoac bam dau x. */}
                <div style={{ position: 'relative' }}>
                  <input className="form-input" style={{ paddingRight: 30 }}
                    value={showModelSuggestions ? modelQuery : (vehicleInfo.vehicleModel || '')}
                    readOnly={isFromLookup || isEdit}
                    onChange={(e) => { setModelQuery(e.target.value); setShowModelSuggestions(true); }}
                    onFocus={() => {
                      if (isFromLookup || isEdit) return;
                      setModelQuery('');
                      setShowModelSuggestions(true);
                    }}
                    onBlur={() => setTimeout(() => setShowModelSuggestions(false), 180)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setShowModelSuggestions(false); e.target.blur(); }
                      // Enter khi danh sach loc con dung 1 dong -> chon luon,
                      // go nhanh khong can roi tay khoi ban phim.
                      if (e.key === 'Enter' && showModelSuggestions && modelSuggestions.length === 1) {
                        e.preventDefault();
                        const m = modelSuggestions[0];
                        setVehicleInfo((p) => ({ ...p, vehicleModel: m.displayName, modelId: m.id }));
                        setShowModelSuggestions(false);
                      }
                    }}
                    placeholder={isFromLookup || isEdit ? ' ' : 'Chọn loại xe'} />
                  {!isFromLookup && !isEdit && (
                    vehicleInfo.modelId && !showModelSuggestions ? (
                      <button type="button" title="Bỏ chọn loại xe"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setVehicleInfo((p) => ({ ...p, vehicleModel: '', modelId: null }));
                          setModelQuery('');
                        }}
                        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-500)', fontSize: 14, lineHeight: 1, padding: 4 }}>✕</button>
                    ) : (
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-500)', fontSize: 10, pointerEvents: 'none' }}>▼</span>
                    )
                  )}
                </div>
                {!isFromLookup && !isEdit && showModelSuggestions && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 100, maxHeight: 260, overflowY: 'auto' }}>
                    {modelSuggestions.length === 0 ? (
                      <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--gray-500)' }}>
                        Không có đời xe nào khớp “{modelQuery}”
                      </div>
                    ) : modelSuggestions.map((m) => (
                      <div key={m.id} onMouseDown={() => {
                        setVehicleInfo((p) => ({ ...p, vehicleModel: m.displayName, modelId: m.id }));
                        setModelQuery('');
                        setShowModelSuggestions(false);
                      }}
                        style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', background: m.id === vehicleInfo.modelId ? 'var(--primary-very-light)' : undefined }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.displayName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Số khung</label>
                  <input className="form-input" value={vehicleInfo.frameNumber}
                    readOnly={isFromLookup || isEdit}
                    onChange={(e) => { vInfoSet('frameNumber', e.target.value); setIsFromLookup(false); setActiveField('frame'); setShowSuggestions(true); }}
                    onFocus={() => { if (!isFromLookup && !isEdit) { setActiveField('frame'); setShowSuggestions(true); } }}
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
                    readOnly={isFromLookup || isEdit}
                    onChange={(e) => { vInfoSet('engineNumber', e.target.value); setIsFromLookup(false); setActiveField('engine'); setShowSuggestions(true); }}
                    onFocus={() => { if (!isFromLookup && !isEdit) { setActiveField('engine'); setShowSuggestions(true); } }}
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
                  <input className="form-input" type="date" value={vehicleInfo.purchaseDate} max={todayInputValue} readOnly={isFromLookup || isEdit} onChange={(e) => vInfoSet('purchaseDate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label required">
                    Số Km hiện tại
                    {vehicleInfo.lastKnownKm != null && (
                      <span style={{ fontWeight: 400, color: 'var(--gray-500)', marginLeft: 6 }}>
                        (Lần trước: {Number(vehicleInfo.lastKnownKm).toLocaleString('vi-VN')} km)
                      </span>
                    )}
                  </label>
                  <input className="form-input" type="number" min={vehicleInfo.lastKnownKm || 0} value={vehicleInfo.currentKm} onChange={(e) => vInfoSet('currentKm', e.target.value)} />
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
      </CollapsibleCard>

      {/* SECTION 1b: Phiếu tiếp nhận và bàn giao xe.
          Khi SUA phieu thi CHI XEM - phan nay ghi lai tinh trang xe DUNG LUC
          tiep nhan, kem chu ky xac nhan cua khach (chu ky cung da khoa khi sua,
          xem ben duoi). Sua lai sau do se lam sai lech ban ghi goc va khien chu
          ky khong con khop voi noi dung khach da ky. */}
      {isEdit ? (
        <CollapsibleCard
          title="Tiếp nhận và bàn giao xe"
          open={openSections.intake}
          onToggle={() => toggleSection('intake')}
          note={(
            <span style={{ fontSize: 12, color: 'var(--gray-500)', fontStyle: 'italic' }}>
              (Chỉ xem — ghi nhận lúc tiếp nhận xe, không sửa được)
            </span>
          )}
        >
          <IntakeChecklistView value={intakeChecklist} vehicleModelText={vehicleInfo.vehicleModel} />
        </CollapsibleCard>
      ) : (
        <IntakeChecklistSection value={intakeChecklist} onChange={setIntakeChecklist}
          vehicleModelText={vehicleInfo.vehicleModel}
          open={openSections.intake} onToggle={() => toggleSection('intake')} />
      )}

      {/* SECTION 3: Hạng mục công việc */}
      <CollapsibleCard
        title="Hạng mục công việc / phụ tùng"
        open={openSections.items}
        onToggle={() => toggleSection('items')}
        summary={`${items.filter((it) => (it.description || '').trim()).length} hạng mục · ${formatCurrency(totals.total || 0)}`}
        bodyStyle={{ padding: 0 }}
        actions={(
          <>
            <button className="btn btn-secondary btn-sm" onClick={addItem} disabled={!canSave}
              title={canSave ? undefined : 'Vui lòng chọn khách hàng và xe trước'}>Thêm dịch vụ</button>
            <button className="btn btn-secondary btn-sm" onClick={addPartItem} disabled={!canSave}
              title={canSave ? undefined : 'Vui lòng chọn khách hàng và xe trước'}>Thêm phụ tùng</button>
          </>
        )}
      >
        <div>
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
                  <th style={{ width: 180 }}>Ghi chú</th>
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
                          {/* Yêu cầu thực hiện của đầu mục theo biểu mẫu "Phiếu kiểm
                              tra BDĐK" - ghi hẳn chữ, không hiện mã I/R/M/V. Chỉ đầu
                              mục con của gói bảo dưỡng mới có. */}
                          {actionLabel(item.actionCode) && (
                            <div style={{ fontSize: 10.5, lineHeight: 1.3, color: 'var(--gray-600)', padding: '1px 8px 2px', fontStyle: 'italic' }}>
                              {actionLabel(item.actionCode)}
                            </div>
                          )}
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
                            <select className="form-select" style={{ fontSize: 12, background: 'transparent' }} value={item.httt}
                              onChange={(e) => (e.target.value === HTTT_CANCELLED_VALUE ? handleCancelItem(idx) : handleHtttChange(idx, e.target.value))}>
                              <option value=""></option>
                              {HTTT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              {(item.httt === HTTT_CANCELLED_VALUE || canOfferCancel(item)) && (
                                <option value={HTTT_CANCELLED_VALUE}>{HTTT_CANCELLED_OPTION.label}</option>
                              )}
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
                          <input className="form-input" style={{ fontSize: 12, background: 'transparent' }} type="number" min={item.lhsc === 'PT' ? 0 : 1}
                            title={item.lhsc === 'PT' ? 'Có thể chỉnh về 0 nếu phụ tùng được hoàn trả lại kho (vd: đã lắp nhưng khách hủy, tháo trả lại) mà không ảnh hưởng tiền công đã tính' : undefined}
                            value={item.qty} readOnly={isChild && item.lhsc !== 'PT' && !item.manualQtyUnlock} onChange={(e) => handleGroupQtyChange(idx, e.target.value)} />
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
                          {exemptionShortLabel(item) ? (
                            <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}> ({exemptionShortLabel(item)})</span>
                          ) : isQuantityReturned(item) && (
                            <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}> (Khách hoàn trả hàng SL x {item.originalQty - item.qty})</span>
                          )}
                        </td>
                        <td>
                          {!isChild && canRemoveGroup(item) && (
                            <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => removeItem(idx)}>Xóa</button>
                          )}
                          {/* Dong dau nhom/dich vu le DA la ban ghi that (canRemoveGroup=false vi
                              da co id) nen khong con nut Xoa - phai co nut Hủy rieng o day, khong
                              the chi trong vao lua chon "Khách hủy" an trong dropdown HTTT (de bi
                              bo sot, xem phan hoi CVDV). */}
                          {!isChild && !canRemoveGroup(item) && canOfferCancel(item) && (
                            <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => handleCancelItem(idx)} title="Khách hủy dịch vụ/gói này">
                              Hủy
                            </button>
                          )}
                          {isChild && item.lhsc === 'DV' && canOfferCancel(item) && (
                            <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => handleCancelItem(idx)} title="Khách hủy riêng dịch vụ này, tách khỏi giá gói combo">
                              Hủy
                            </button>
                          )}
                        </td>
                        <td>
                          <input className="form-input" style={{ fontSize: 12, background: 'transparent' }} value={item.note || ''}
                            onChange={(e) => setItem(idx, 'note', e.target.value)}
                            placeholder="Lưu ý cho thợ…" title="Ghi chú riêng cho hạng mục này, hiển thị cho tổ trưởng/thợ ở màn Khoang xe" />
                        </td>
                      </tr>
                    );
                  };

                  return (
                    <>
                      <tr>
                        <td style={{ background: 'var(--gray-200)' }}></td>
                        <td colSpan={10} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>CÔNG VIỆC CẦN THỰC HIỆN</td>
                      </tr>
                      {laborRows.map(renderRow)}
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                        <td style={{ fontWeight: 700 }}>{laborSubtotal.toLocaleString('vi-VN')}</td>
                        <td></td>
                        <td></td>
                      </tr>

                      {partRows.length > 0 && (
                        <>
                          <tr>
                            <td style={{ background: 'var(--gray-200)' }}></td>
                            <td colSpan={10} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>PHỤ TÙNG, VẬT TƯ</td>
                          </tr>
                          {partRows.map(renderRow)}
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>Cộng</td>
                            <td style={{ fontWeight: 700 }}>{partSubtotal.toLocaleString('vi-VN')}</td>
                            <td></td>
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
      </CollapsibleCard>

      {isEdit && (() => {
        const serviceTasks = (liveOrderInfo.tasks || []).filter((t) => t.taskType === 'service');
        if (serviceTasks.length === 0) return null;
        const activeServiceTasks = serviceTasks.filter((t) => !t.isCancelled);
        const doneCount = activeServiceTasks.filter((t) => t.isDone).length;
        return (
          <div style={{ marginTop: 16 }}>
            <div className="form-section-title">
              Tiến độ công việc ({doneCount}/{activeServiceTasks.length})
            </div>
            {(liveOrderInfo.bayNumber || liveOrderInfo.technicians?.length > 0) && (
              <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 8 }}>
                {liveOrderInfo.bayNumber && <>Khoang đang thực hiện: <b>{liveOrderInfo.bayNumber}</b></>}
                {liveOrderInfo.bayNumber && liveOrderInfo.technicians?.length > 0 && '  ·  '}
                {liveOrderInfo.technicians?.length > 0 && <>Thợ thực hiện: <b>{liveOrderInfo.technicians.map(formatTechnicianLabel).join(', ')}</b></>}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {serviceTasks.map((t) => (
                <label
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: t.isCancelled ? 'var(--gray-50)' : (t.isDone ? '#E8F5E9' : 'var(--gray-50)'), borderRadius: 6,
                    fontSize: 13,
                    color: t.isCancelled ? 'var(--gray-400)' : (t.isDone ? '#2E7D32' : 'var(--gray-900)'),
                  }}
                >
                  <input type="checkbox" checked={t.isDone} disabled readOnly style={{ accentColor: '#2E7D32' }} />
                  <TaskNameLabel t={t} />
                </label>
              ))}
            </div>
          </div>
        );
      })()}

      </fieldset>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        {!isEdit && !savedOrder && (
          <div className="card" style={{ flex: '1 1 360px', maxWidth: 460 }}>
            <div className="card-body">
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--gray-600)', marginBottom: 10 }}>
                Ngày {signatureDate.getDate()} tháng {signatureDate.getMonth() + 1} năm {signatureDate.getFullYear()}
              </div>
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
                Xác nhận đồng ý phiếu quyết toán
              </div>
              <SignaturePad ref={signaturePadRef} onChange={setSignatureEmpty} />
              <input className="form-input"
                style={{
                  width: '100%', textAlign: 'center', fontWeight: 600, marginTop: 10,
                  border: 'none', borderTop: '1px solid var(--gray-200)', borderRadius: 0, paddingTop: 10,
                }}
                placeholder="Tên người ký"
                value={signerName}
                onChange={(e) => { signerNameEditedRef.current = true; setSignerName(e.target.value); }} />
            </div>
          </div>
        )}

        {isEdit && (existingOrder?.signatureData ? (
          <div className="card" style={{ flex: '1 1 280px', maxWidth: 360 }}>
            <div className="card-body">
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                Xác nhận đồng ý phiếu quyết toán
              </div>
              <img
                src={existingOrder.signatureData}
                alt="Chữ ký xác nhận"
                style={{ display: 'block', margin: '0 auto', height: 90, border: '1px solid var(--gray-200)', borderRadius: 6, background: '#fff' }}
              />
              {existingOrder.signerName && (
                <div style={{
                  textAlign: 'center', fontSize: 12.5, fontWeight: 600, marginTop: 10,
                  borderTop: '1px solid var(--gray-200)', paddingTop: 8,
                }}>
                  {existingOrder.signerName}
                </div>
              )}
              {existingOrder.signedAt && (
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                  Ký lúc: {existingOrder.signedAt}
                </div>
              )}
            </div>
          </div>
        ) : <div />)}

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

            {!canSave && !closedElsewhere && (
              <div style={{ fontSize: 12, color: '#E65100', marginBottom: 8 }}>
                {isFromLookup
                  ? 'Vui lòng chọn khách hàng và xe từ gợi ý tra cứu để có thể lưu.'
                  : 'Vui lòng nhập đủ tên khách hàng, số điện thoại, biển số xe, hãng xe và tên xe để có thể lưu.'}
              </div>
            )}

            {closedElsewhere ? (
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/repair-settlement')}>
                Quay lại danh sách
              </button>
            ) : savedOrder ? (
              <>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
                  onClick={() => setSavedOrder(null)}>
                  Chỉnh sửa lại phiếu
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => navigate('/repair-settlement')}>
                  Quay lại danh sách
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
                  disabled={!canSave || saving || locked || (!isEdit && signatureEmpty)}
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
  const location = useLocation();

  // key={location.pathname}: "create" va "edit/:id" deu render cung 1
  // component RepairSettlementForm o cung vi tri trong cay - React Router
  // khong tu unmount/remount khi chi doi Route nao khop (cung type, cung
  // cho), nen state cu (fetchedOrder, form da nhap...) bi giu lai khi tu
  // Sua chuyen sang Tao moi qua navbar. Key theo pathname (khac nhau giua
  // create/edit/:id) ep remount that su moi lan doi mode hoac doi id.
  return (
    <Routes>
      <Route index element={<RepairSettlementList />} />
      <Route
        path="create"
        element={canManage ? <RepairSettlementForm key={location.pathname} /> : <Navigate to="/repair-settlement" replace />}
      />
      <Route
        path="edit/:id"
        element={canManage ? <RepairSettlementForm key={location.pathname} isEdit /> : <Navigate to="/repair-settlement" replace />}
      />
    </Routes>
  );
}
