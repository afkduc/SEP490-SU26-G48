// In "Phieu tiep nhan va ban giao xe" - ban giay cua khoi kiem tra tinh trang
// xe luc tiep nhan, kem chu ky KHACH va chu ky CO VAN LAP PHIEU (moc 1).
//
// Tach file rieng vi RepairSettlementPage.jsx da qua dai, va noi dung phieu
// nay doc lap hoan toan voi phieu quyet toan (khong co tien nong, chi la tinh
// trang xe luc nhan - cai khach ky de sau nay khong cai nhau "xe toi co vet
// xuoc do tu truoc").
import {
  DEFAULT_INTAKE_CHECKLIST,
  INTERIOR_FIELDS,
  ITEMS_IN_CAR_FIELDS,
  EXTERIOR_LEFT_FIELDS,
  EXTERIOR_RIGHT_FIELDS,
  ENGINE_BAY_FIELDS,
  PRIORITY_FIELDS,
  OTHER_INFO_FIELDS,
  FUEL_GAUGE_OPTIONS,
  SEGMENT_DIAGRAMS,
  detectSegmentFromModelText,
} from './IntakeChecklistSection';
import { INTAKE_NOTICE_LINES } from './intakeNotice';
import { khoiTieuDeIn, PRINT_HEADER_CSS, urlAsset } from './printHeader';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const NHAN_GOC = { left: 'Trái', right: 'Phải', front: 'Trước', rear: 'Sau', top: 'Trên' };
const SEGMENT_LABEL = { sedan: 'Sedan/Hatchback', suv: 'SUV/Crossover', pickup: 'Bán tải' };

// So do xe kem dau X danh dau vet xuoc/mop - IN LAI DUNG NHU tren man hinh
// tiep nhan (MarkableImage trong IntakeChecklistSection.jsx): cung 5 anh theo
// phan khuc, cung toa do %x/%y, cung mau do. Anh tinh nam trong FE/public/
// vehicle-diagrams/ nen phai qua urlAsset() (duong dan tuyet doi) - cua so in
// mo bang document.write() khong co <base> de giai duong dan tuong doi.
function khoiSoDoXe(vehicleModelText, marks) {
  const phanKhuc = detectSegmentFromModelText(vehicleModelText);
  const images = SEGMENT_DIAGRAMS[phanKhuc] || SEGMENT_DIAGRAMS.sedan;
  const oAnh = images.map((img) => {
    const goc = img.split('-')[1];
    const dauXCuaAnh = (marks || []).filter((m) => m.diagram === img);
    const dauX = dauXCuaAnh.map((m) => `<span class="sdx-x" style="left:${m.xPct}%;top:${m.yPct}%">✕</span>`).join('');
    return `
      <div class="sdx-item">
        <div class="sdx-wrap"><img src="${urlAsset(`/vehicle-diagrams/${img}.png`)}" />${dauX}</div>
        <div class="sdx-label">${esc(NHAN_GOC[goc] || goc)}</div>
      </div>`;
  }).join('');
  return `
    <div class="khoi">
      <div class="khoi-title">Sơ đồ đánh dấu vết xước / móp (${esc(SEGMENT_LABEL[phanKhuc] || phanKhuc)})</div>
      <div class="sdx-grid">${oAnh}</div>
    </div>`;
}

// Cac muc kiem tra luu 3 trang thai: 'OK' | 'NG' | null (chua danh gia).
const okNg = (v) => (v === 'OK' ? 'Đạt' : v === 'NG' ? 'Không đạt' : '—');
// Do dung trong xe / uu tien luu true | false | null.
const coKhong = (v) => (v === true ? 'Có' : v === false ? 'Không' : '—');

function bang(tieuDe, cacDong) {
  return `
    <div class="khoi">
      <div class="khoi-title">${esc(tieuDe)}</div>
      <table class="kt">${cacDong.join('')}</table>
    </div>`;
}

function dongDoi(cap) {
  // 2 cot moi hang cho phieu ngan lai - phieu tiep nhan von in 1 mat giay.
  const ra = [];
  for (let i = 0; i < cap.length; i += 2) {
    const [l1, v1] = cap[i];
    const o2 = cap[i + 1];
    ra.push(`<tr>
      <td class="lbl">${esc(l1)}</td><td class="val">${esc(v1)}</td>
      <td class="lbl">${o2 ? esc(o2[0]) : ''}</td><td class="val">${o2 ? esc(o2[1]) : ''}</td>
    </tr>`);
  }
  return ra;
}

function oKy(tieuDe, anh, ten) {
  const than = anh
    ? `<img class="sign-img" src="${anh}" /><div class="sign-line has-img">${esc(ten || '')}</div>`
    : `<div class="sign-line">${esc(ten || '')}</div>`;
  return `<div class="sign-box"><div class="bold">${esc(tieuDe)}</div>${than}</div>`;
}

/**
 * @param {Object} order     phieu quyet toan (da co intakeChecklist + chu ky)
 * @param {Object} tuyChon   { khongChuKy } - in ban trang de ky tay
 * @param {Function} moCuaSoIn  ham mo cua so in dung chung cua trang
 * @returns {string|null} thong bao loi neu trinh duyet chan popup
 */
export function printIntakeSheet(order, { khongChuKy = false } = {}, moCuaSoIn) {
  const v = order.intakeChecklist || DEFAULT_INTAKE_CHECKLIST;
  const xe = order.vehicle || {};
  const kh = order.customer || {};

  const khoiOkNg = (tieuDe, fields, nguon) =>
    bang(tieuDe, dongDoi((fields || []).map(([k, l]) => [l, okNg((nguon || {})[k])])));

  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<title>Phiếu tiếp nhận xe ${esc(order.code)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 10mm 12mm; color: #000; }
  table { width: 100%; border-collapse: collapse; }
  .head td { border: none; padding: 2px 0; font-size: 11px; }
  .khoi { margin-top: 7px; break-inside: avoid; }
  .khoi-title { font-weight: 700; font-size: 11px; background: #EEE; padding: 3px 6px; border: 1px solid #BBB; }
  .kt td { border: 1px solid #CCC; padding: 3px 6px; }
  .kt .lbl { width: 30%; }
  .kt .val { width: 20%; text-align: center; }
  .ghi-chu { border: 1px solid #CCC; padding: 5px 6px; min-height: 26px; }
  .sdx-grid { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding-top: 4px; }
  .sdx-item { width: 31%; text-align: center; }
  .sdx-wrap { position: relative; border: 1px solid #CCC; background: #fff; }
  .sdx-wrap img { width: 100%; height: auto; display: block; }
  .sdx-x { position: absolute; transform: translate(-50%, -50%); color: #dc2626; font-size: 14px;
           font-weight: 900; line-height: 1; text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 2px #fff; }
  .sdx-label { font-size: 9.5px; font-weight: 700; color: #555; margin-top: 2px; }
  .cam-ket { margin-top: 8px; border: 1px solid #999; border-left: 3px solid #333; padding: 6px 8px; font-size: 10.5px; line-height: 1.5; }
  .sign-row { display: flex; justify-content: space-around; margin-top: 16px; }
  .sign-box { text-align: center; width: 40%; }
  .sign-img { height: 46px; max-width: 100%; object-fit: contain; display: block; margin: 2px auto 0; }
  .sign-line { margin-top: 42px; border-top: 1px solid #000; padding-top: 3px; font-size: 10px; }
  .sign-line.has-img { margin-top: 0; }
  ${PRINT_HEADER_CSS}
</style></head><body>
${khoiTieuDeIn('PHIẾU TIẾP NHẬN VÀ BÀN GIAO XE', {
    chiNhanh: order.branch,
    phuDe: `Số RO: <b>${esc(order.code)}</b> &nbsp;|&nbsp; Ngày tiếp nhận: <b>${esc(order.date || '')}</b>`,
  })}
<table class="head">
  <tr>
    <td style="width:50%"><b>Khách hàng:</b> ${esc(kh.fullName)}</td>
    <td><b>Điện thoại:</b> ${esc(kh.phone)}</td>
  </tr>
  <tr>
    <td><b>Biển số xe:</b> ${esc(xe.licensePlate)}</td>
    <td><b>Dòng xe:</b> ${esc(xe.vehicleModel)}</td>
  </tr>
  <tr>
    <td><b>Số km:</b> ${Number(xe.currentKm || 0).toLocaleString('vi-VN')}</td>
    <td><b>Cố vấn dịch vụ:</b> ${esc(order.advisor)}</td>
  </tr>
</table>

${khoiOkNg('Nội thất', INTERIOR_FIELDS, v.interior)}
${bang('Nhiên liệu & cảnh báo', dongDoi([
    ['Mức nhiên liệu', FUEL_GAUGE_OPTIONS.includes(v.fuelGauge) ? v.fuelGauge : '—'],
    ['Đèn cảnh báo', v.warningLights || '—'],
  ]))}
${bang('Đồ dùng trong xe', dongDoi([
    ...ITEMS_IN_CAR_FIELDS.map(([k, l]) => [l, coKhong((v.itemsInCar || {})[k])]),
    ['Khác', v.itemsInCarOther || '—'],
  ]))}
${khoiOkNg('Ngoại thất trái / trước', EXTERIOR_LEFT_FIELDS, v.exteriorLeftFront)}
${khoiOkNg('Ngoại thất phải / sau', EXTERIOR_RIGHT_FIELDS, v.exteriorRightRear)}
${khoiOkNg('Khoang động cơ', ENGINE_BAY_FIELDS, v.engineBay)}
${bang('Ưu tiên', dongDoi(PRIORITY_FIELDS.map(([k, l]) => [l, coKhong((v.priority || {})[k])])))}
${bang('Thông tin khác', dongDoi(OTHER_INFO_FIELDS.map(([k, l]) => [l, coKhong((v.otherInfo || {})[k])])))}

${khoiSoDoXe(xe.vehicleModel, (v.exteriorBody || {}).marks)}
<div class="khoi">
  <div class="khoi-title">Tình trạng thân vỏ (vết xước / móp) — ghi chú</div>
  <div class="ghi-chu">${esc((v.exteriorBody || {}).notes) || '—'}</div>
</div>

<div class="khoi">
  <div class="khoi-title">Ghi chú tiếp nhận</div>
  <div class="ghi-chu">${esc(v.notes) || '—'}</div>
</div>

<div class="cam-ket">${INTAKE_NOTICE_LINES.map((d) => `<div>${esc(d)}</div>`).join('')}</div>

<div class="sign-row">
  ${oKy('Khách hàng', khongChuKy ? null : order.signatureData, khongChuKy ? '' : (order.signerName || kh.fullName))}
  ${oKy('Cố vấn dịch vụ tiếp nhận', khongChuKy ? null : order.advisorSignatureData, khongChuKy ? '' : order.advisor)}
</div>
</body></html>`;

  return moCuaSoIn(html);
}

export default printIntakeSheet;
