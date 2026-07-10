import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { ROLES } from '../../constants/roles';
import { formatCurrency } from '../../utils';
import { searchVehiclesApi } from '../../services/vehicleApi';
import { searchCatalogApi } from '../../services/catalogApi';
import {
  listRepairSettlementsApi,
  getRepairSettlementApi,
  createRepairSettlementApi,
  updateRepairSettlementApi,
  updateRepairSettlementStatusApi,
} from '../../services/repairSettlementApi';
import { MOCK_BRANCH, STATUS_LABELS } from './mockData';

// Value giữ mã ngắn (khớp dữ liệu lưu/in phiếu), label hiển thị đầy đủ trên form nhập liệu.
const LHSC_OPTIONS = [
  { value: 'DV', label: 'Dịch vụ' },
  { value: 'PT', label: 'Phụ tùng' },
  { value: 'BH', label: 'Bảo hành' },
  { value: 'HD', label: 'Hợp đồng' },
];
const HTTT_OPTIONS = [
  { value: 'KHT', label: 'Khách hàng thanh toán' },
  { value: 'BH', label: 'Bảo hiểm chi trả' },
  { value: 'HD', label: 'Hợp đồng bảo dưỡng' },
  { value: 'NB', label: 'Nội bộ chịu phí' },
];

const TABS = [
  { key: 'waiting_repair', label: 'Chờ sửa chữa', color: '#E65100' },
  { key: 'inprogress', label: 'Đang sửa chữa', color: '#1565C0' },
  { key: 'waiting_payment', label: 'Chờ thanh toán', color: '#2E7D32', highlight: true },
  { key: 'invoiced', label: 'Đã xuất hóa đơn', color: '#616161' },
];

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
  return { code: '', serviceId: null, description: '', lhsc: 'DV', httt: 'KHT', unit: 'Lần', qty: 1, unitPrice: 0, discount: 0, isFree: false, total: 0 };
}

// Che dữ liệu nhạy cảm (điện thoại, email, CCCD) khi hiển thị dữ liệu đã tra cứu
// từ DB — chỉ hiện 4 ký tự cuối, phần còn lại thay bằng dấu *.
function maskLast4(value) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= 4) return '*'.repeat(str.length);
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

function recalcItem(item) {
  const base = (item.qty || 0) * (item.unitPrice || 0);
  const disc = base * ((item.discount || 0) / 100);
  return { ...item, total: item.isFree ? 0 : Math.round(base - disc) };
}

function calcTotals(items) {
  const subtotal = items.reduce((s, i) => s + (i.isFree ? 0 : (i.qty || 0) * (i.unitPrice || 0) * (1 - (i.discount || 0) / 100)), 0);
  const discountAmount = items.reduce((s, i) => s + (i.isFree ? 0 : (i.qty || 0) * (i.unitPrice || 0) * ((i.discount || 0) / 100)), 0);
  const vat = Math.round(subtotal * 0.08);
  const freeAmount = items.filter((i) => i.isFree).reduce((s, i) => s + (i.qty || 0) * (i.unitPrice || 0), 0);
  return {
    subtotal: Math.round(subtotal),
    discountAmount: Math.round(discountAmount),
    afterDiscount: Math.round(subtotal),
    vat,
    freeAmount: Math.round(freeAmount),
    total: Math.round(subtotal) + vat,
  };
}

// ─── In danh sách công việc (cho KTV) ────────────────────────────────
function printWorkList(order) {
  const rows = (order.items || []).map((item, i) => `
    <tr>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;font-family:monospace;font-size:10px">${item.code || ''}</td>
      <td style="border:1px solid #ccc;padding:4px 7px">${item.description}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:center">${item.lhsc}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:center">${item.unit}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:center">${item.qty}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:right">${(item.unitPrice || 0).toLocaleString('vi-VN')}</td>
      <td style="border:1px solid #ccc;padding:4px 7px;text-align:right">${(item.total || 0).toLocaleString('vi-VN')}</td>
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
  <thead><tr><th style="width:28px">STT</th><th style="width:75px">Mã số</th><th>Nội dung công việc</th><th style="width:45px">LHSC</th><th style="width:45px">ĐVT</th><th style="width:32px">SL</th><th style="width:95px">Đơn giá</th><th style="width:95px">Thành tiền</th><th style="width:70px">Ký xác nhận</th></tr></thead>
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
function printSettlement(order) {
  const itemsHtml = (order.items || []).map((item, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center">${item.code}</td>
      <td>${item.description}</td>
      <td style="text-align:center">${item.lhsc}</td>
      <td style="text-align:center">${item.httt}</td>
      <td style="text-align:center">${item.unit}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right">${(item.unitPrice || 0).toLocaleString('vi-VN')}</td>
      <td style="text-align:center">${item.discount || 0}%</td>
      <td style="text-align:center">${item.isFree ? '✓' : ''}</td>
      <td style="text-align:right"><b>${(item.total || 0).toLocaleString('vi-VN')}</b></td>
    </tr>`).join('');

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
    <td><b>Điện thoại:</b> ${order.customer?.phone} &nbsp; <b>MST:</b> ${order.customer?.taxCode || '—'}</td>
    <td><b>Ngày mua:</b> ${order.vehicle?.purchaseDate || '—'}</td>
    <td><b>Số Km:</b> ${(order.vehicle?.currentKm || 0).toLocaleString()}</td>
  </tr>
  <tr>
    <td><b>CCCD:</b> ${order.customer?.cccd || '—'}</td>
    <td colspan="2"><b>Yêu cầu KH:</b> ${order.customerRequest || ''}</td>
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

<table class="totals" style="margin-top:6px; width:50%; margin-left:auto">
  <tr><td class="lbl">Tổng cộng trước giảm giá:</td><td class="val">${(order.subtotal || 0).toLocaleString('vi-VN')}</td></tr>
  <tr><td class="lbl">Tổng cộng giảm giá:</td><td class="val">${(order.discountAmount || 0).toLocaleString('vi-VN')}</td></tr>
  <tr><td class="lbl">Tổng cộng sau giảm giá:</td><td class="val">${(order.afterDiscount || 0).toLocaleString('vi-VN')}</td></tr>
  <tr><td class="lbl">Tiền thuế GTGT (8%):</td><td class="val">${(order.vat || 0).toLocaleString('vi-VN')}</td></tr>
  <tr><td class="lbl">Miễn phí:</td><td class="val">${(order.freeAmount || 0).toLocaleString('vi-VN')}</td></tr>
  <tr style="font-size:13px"><td class="lbl"><b>Tổng giá trị thanh toán:</b></td><td class="val" style="color:#C62828"><b>${(order.total || 0).toLocaleString('vi-VN')}</b></td></tr>
  <tr><td colspan="2" style="font-size:10px; font-style:italic; text-align:right">Bằng chữ: ${numberToVietnamese(order.total)}</td></tr>
</table>

<div style="font-size:10px;border-top:1px solid #ccc;padding-top:4px;margin-top:8px">
  Lần bảo dưỡng kế tiếp: <b>${order.nextMaintenanceKm ? order.nextMaintenanceKm.toLocaleString() + ' km' : '……… km'}</b> hoặc ngày <b>${order.nextMaintenanceDate || '………………'}</b>.
  Phụ tùng thay thế tại trung tâm Dịch vụ ủy quyền AutoGara được bảo hành 06 tháng hoặc 10.000km tùy theo điều kiện nào đến trước.
  <br>Phiếu này chỉ có giá trị xuất hóa đơn trong ngày.
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
  w.print();
}

// ─── Modal xem trước & xuất phiếu quyết toán ────────────────────────
function SettlementPreviewModal({ order, onClose, onConfirm, canManage }) {
  const canConfirm = canManage && order.status === 'waiting_payment';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <h3 className="modal-title">📋 Quyết toán sửa chữa — {order.code}</h3>
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
                    <td className="td-cell">{s.description}{s.isFree && <span className="tag" style={{ marginLeft: 6 }}>Miễn phí</span>}</td>
                    <td className="td-cell" style={{ textAlign: 'center' }}>{s.lhsc}</td>
                    <td className="td-cell" style={{ textAlign: 'center' }}>{s.unit}</td>
                    <td className="td-cell" style={{ textAlign: 'center' }}>{s.qty}</td>
                    <td className="td-cell" style={{ textAlign: 'right' }}>{(s.unitPrice || 0).toLocaleString('vi-VN')}</td>
                    <td className="td-cell" style={{ textAlign: 'right', fontWeight: 700 }}>{(s.total || 0).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginTop: 10 }}>
              <div style={{ flex: 1, fontSize: 11 }}>
                <b>Bằng chữ:</b> <i>{numberToVietnamese(order.total)}</i>
                <div style={{ fontSize: 10, color: '#444', marginTop: 4, lineHeight: 1.6 }}>
                  Lần bảo dưỡng kế tiếp: {order.nextMaintenanceKm ? `${order.nextMaintenanceKm.toLocaleString()} km` : '……… km'} hoặc ngày {order.nextMaintenanceDate || '………'}.
                  <br /><i>Phiếu này chỉ có giá trị xuất hóa đơn trong ngày.</i>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <div style={{ width: 90, height: 90, border: '1px dashed #999', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#999' }}>
                  QR Code
                </div>
                <div style={{ fontSize: 9, color: '#888' }}>Quét để thanh toán</div>
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
          <button className="btn btn-secondary" onClick={() => printSettlement(order)}>🖨️ In phiếu quyết toán</button>
          {canConfirm && (
            <button className="btn btn-primary" onClick={() => { onConfirm(order.id); onClose(); }}>
              ✅ Xác nhận xuất hóa đơn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal xem chi tiết phiếu ────────────────────────────────────────
function DetailModal({ order, onClose, onComplete, onPreview, canManage }) {
  const st = STATUS_LABELS[order.status];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h3 className="modal-title">📋 Quyết toán sửa chữa – {order.code}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`badge ${st?.badge}`}>{st?.label}</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
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
                <tr><th>#</th><th>Mã</th><th>Nội dung</th><th>LHSC</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>CK%</th><th>Thành tiền</th></tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.code}</span></td>
                    <td>{item.description}</td>
                    <td style={{ textAlign: 'center' }}><span className="tag">{item.lhsc}</span></td>
                    <td style={{ textAlign: 'center' }}>{item.unit}</td>
                    <td style={{ textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right' }}>{(item.unitPrice || 0).toLocaleString('vi-VN')}</td>
                    <td style={{ textAlign: 'center' }}>{item.discount || 0}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{(item.total || 0).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
          {order.status === 'inprogress' && (<>
            <button className="btn btn-secondary" onClick={() => { onClose(); printWorkList(order); }}>🖨️ In DS công việc</button>
            {canManage && (
              <button className="btn btn-primary" onClick={() => { onClose(); onComplete(order.id); }}>✅ Đánh dấu hoàn thành</button>
            )}
          </>)}
          {(order.status === 'waiting_payment' || order.status === 'invoiced') && (
            <button className="btn btn-primary" style={{ background: '#2E7D32', borderColor: '#2E7D32' }}
              onClick={() => { onClose(); onPreview(order); }}>
              🖨️ Xem / In phiếu quyết toán
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
  const canManage = user?.primaryRole !== ROLES.ADMIN;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('waiting_repair');
  const [search, setSearch] = useState('');
  const [view, setView] = useState(null);
  const [previewOrder, setPreviewOrder] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listRepairSettlementsApi({ limit: 200 })
      .then((result) => { if (alive) setOrders(result.items || []); })
      .catch((err) => { if (alive) setLoadError(err.message || 'Không tải được danh sách phiếu quyết toán'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

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

  const handleComplete = async (id) => {
    const updated = await updateRepairSettlementStatusApi(id, 'waiting_payment');
    setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    setTab('waiting_payment');
  };

  const handleInvoice = async (id) => {
    const updated = await updateRepairSettlementStatusApi(id, 'invoiced');
    setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    setTab('invoiced');
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
            🏢 {user?.branchName || user?.branch || MOCK_BRANCH}
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
                borderColor: isActive ? t.color : (t.highlight && count > 0 ? '#FFC107' : 'var(--gray-300)'),
                background: isActive ? t.color : (t.highlight && count > 0 ? '#FFF9C4' : 'var(--gray-100)'),
                color: isActive ? 'white' : (t.highlight && count > 0 ? '#E65100' : 'var(--gray-700)'),
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {t.label}
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.3)' : (t.highlight && count > 0 ? '#FFC107' : 'var(--gray-300)'),
                color: isActive ? 'white' : (t.highlight && count > 0 ? '#fff' : 'var(--gray-600)'),
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{count}</span>
            </button>
          );
        })}
        <div className="search-input" style={{ marginLeft: 'auto', minWidth: 260 }}>
          <span className="search-icon">🔍</span>
          <input placeholder="Mã RO, biển số, tên khách hàng..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loadError && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#C62828' }}>
          ⚠️ {loadError}
        </div>
      )}

      {tab === 'waiting_payment' && counts.waiting_payment > 0 && (
        <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#2E7D32' }}>
          🧾 Nhấn <b>Xuất hóa đơn</b> để xem/in phiếu quyết toán và hoàn tất dịch vụ.
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
                  <div className="empty-state-icon">📭</div>
                  <h3>Chưa có phiếu quyết toán nào</h3>
                  <p>Không có phiếu nào ở trạng thái này.</p>
                </div>
              </td></tr>
            )}
            {filtered.map((o) => {
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
                    {o.teamLeader ? <span>👨‍🔧 {o.teamLeader}</span> : <span style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Chưa gán</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{o.date}</td>
                  <td style={{ fontWeight: 700, color: '#C62828' }}>{formatCurrency(o.total)}</td>
                  <td><span className={`badge ${st?.badge}`}>{st?.label}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-info btn-sm btn-icon" title="Xem chi tiết" onClick={() => setView(o)}>👁️</button>

                      {o.status === 'inprogress' && (<>
                        <button className="btn btn-secondary btn-sm btn-icon" title="In danh sách CV" onClick={() => printWorkList(o)}>🖨️</button>
                        {canManage && (
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => handleComplete(o.id)}>✅ Hoàn thành</button>
                        )}
                      </>)}

                      {o.status === 'waiting_payment' && (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11, background: '#2E7D32', borderColor: '#2E7D32' }}
                          onClick={() => setPreviewOrder(o)}>
                          🧾 Xuất HĐ
                        </button>
                      )}

                      {o.status === 'invoiced' && (
                        <button className="btn btn-secondary btn-sm btn-icon" title="Xem / In lại" onClick={() => setPreviewOrder(o)}>🖨️</button>
                      )}

                      {canManage && o.status !== 'invoiced' && (
                        <Link to={`/repair-settlement/edit/${o.id}`} state={{ order: o }} className="btn btn-warning btn-sm btn-icon" title="Chỉnh sửa">✏️</Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">{filtered.length}/{orders.length} phiếu</span>
        </div>
      </div>

      {view && (
        <DetailModal
          order={view}
          onClose={() => setView(null)}
          onComplete={handleComplete}
          onPreview={setPreviewOrder}
          canManage={canManage}
        />
      )}

      {previewOrder && (
        <SettlementPreviewModal
          order={previewOrder}
          onClose={() => setPreviewOrder(null)}
          onConfirm={handleInvoice}
          canManage={canManage}
        />
      )}
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
  if (loadOrderError) return <div className="page-loading">⚠️ {loadOrderError}</div>;

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
  });

  const [customerRequest, setCustomerRequest] = useState(existingOrder?.customerRequest || '');
  const [nextKm, setNextKm] = useState(existingOrder?.nextMaintenanceKm || '');
  const [nextDate, setNextDate] = useState(existingOrder?.nextMaintenanceDate || '');
  const [items, setItems] = useState(existingOrder?.items?.length ? existingOrder.items : [emptyItem()]);
  // Tra cứu hạng mục công việc / gói combo thật trong DB khi gõ ô "Mã hạng mục".
  const [activeCatalogIdx, setActiveCatalogIdx] = useState(null); // dòng nào đang mở dropdown gợi ý
  const [catalogSuggestions, setCatalogSuggestions] = useState({}); // idx -> { services, packages }
  // Toạ độ (viewport) của ô đang mở dropdown - dropdown render qua portal ra
  // ngoài table-wrapper (vốn overflow:auto để cuộn ngang bảng) để không bị cắt/cuộn kẹt.
  const [catalogDropdownRect, setCatalogDropdownRect] = useState(null);
  const catalogSearchSeq = useRef(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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

  // Tra cứu hạng mục công việc / gói combo thật trong DB theo tên (hoặc mã),
  // debounce 300ms giống các ô tra cứu khách hàng/xe ở trên. Auto lọc real-time
  // theo đúng text đang gõ trong ô "Tên hạng mục / gói combo".
  useEffect(() => {
    if (activeCatalogIdx === null) return undefined;
    const idx = activeCatalogIdx;
    const term = (items[idx]?.description || '').trim();
    if (term.length < 2) {
      setCatalogSuggestions((prev) => ({ ...prev, [idx]: null }));
      return undefined;
    }
    const seq = ++catalogSearchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const result = await searchCatalogApi(term);
        if (seq === catalogSearchSeq.current) setCatalogSuggestions((prev) => ({ ...prev, [idx]: result }));
      } catch {
        if (seq === catalogSearchSeq.current) setCatalogSuggestions((prev) => ({ ...prev, [idx]: null }));
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCatalogIdx, items[activeCatalogIdx]?.description]);

  const fillFromRow = (row) => {
    setCustomerInfo({
      id: row.customerId, fullName: row.fullName, address: row.address || '', phone: row.phone || '',
      taxCode: row.taxCode || '', cccd: row.cccd || '', email: row.email || '',
      contactPerson: row.contactName || row.fullName, contactPhone: row.contactPhone || row.phone,
    });
    setVehicleInfo({
      id: row.vehicleId, licensePlate: row.licensePlate, vehicleModel: row.vehicleModel || '',
      frameNumber: row.frameNumber || '', engineNumber: row.engineNumber || '',
      purchaseDate: row.purchaseDate ? String(row.purchaseDate).slice(0, 10) : '', currentKm: row.currentKm || '',
    });
    setCustomerQuery(row.fullName);
    setPlateQuery(row.licensePlate);
    setIsFromLookup(true);
    setShowSuggestions(false);
  };

  const cInfoSet = (k, v) => setCustomerInfo((p) => ({ ...p, [k]: v }));
  const vInfoSet = (k, v) => setVehicleInfo((p) => ({ ...p, [k]: v }));

  const setItem = (idx, key, val) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = recalcItem({ ...next[idx], [key]: val });
      return next;
    });
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const handleItemDescription = (idx, val) => {
    setItem(idx, 'description', val);
    setActiveCatalogIdx(idx);
  };

  const closeCatalogSuggestions = (idx) => {
    setCatalogSuggestions((prev) => ({ ...prev, [idx]: null }));
    setActiveCatalogIdx((cur) => (cur === idx ? null : cur));
    setCatalogDropdownRect(null);
  };

  const openCatalogDropdown = (idx, inputEl) => {
    const rect = inputEl.getBoundingClientRect();
    setCatalogDropdownRect({ top: rect.bottom, left: rect.left, width: rect.width });
    setActiveCatalogIdx(idx);
  };

  // Chọn 1 hạng mục đơn lẻ từ catalog -> điền đúng dòng đang gõ, không giảm giá.
  const selectCatalogService = (idx, svc) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = recalcItem({ ...next[idx], code: svc.code, serviceId: svc.id, description: svc.name, unitPrice: svc.unitPrice, lhsc: 'DV', discount: 0 });
      return next;
    });
    closeCatalogSuggestions(idx);
  };

  // Chọn 1 gói combo -> gộp vào đúng 1 dòng, tên hạng mục là tên gói kèm
  // danh sách hạng mục nhỏ bên trong mở ngoặc, đơn giá = giá trọn gói.
  const selectCatalogPackage = (idx, pkg) => {
    const itemNames = pkg.items.map((it) => it.serviceName).join(', ');
    const description = `${pkg.name} (${itemNames})`;
    setItems((prev) => {
      const next = [...prev];
      next[idx] = recalcItem({
        ...next[idx],
        code: pkg.code,
        serviceId: null,
        description,
        unitPrice: pkg.totalPrice,
        qty: 1,
        lhsc: 'DV',
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
    nextMaintenanceKm: nextKm ? Number(nextKm) : null,
    nextMaintenanceDate: nextDate,
  });

  const handleSave = async (andPrintWorkList = false) => {
    if (!canSave) {
      setSaveError('Vui lòng chọn khách hàng và xe từ gợi ý tra cứu trước khi lưu.');
      return;
    }
    setSaving(true);
    setSaveError('');
    let order;
    try {
      const payload = buildPayload();
      order = isEdit
        ? await updateRepairSettlementApi(existingOrder.id, payload)
        : await createRepairSettlementApi(payload);
    } catch (err) {
      setSaveError(err.message || 'Lưu phiếu quyết toán thất bại');
      setSaving(false);
      return;
    }
    setSaving(false);
    if (andPrintWorkList) printWorkList(order);
    setSaved(true);
    setTimeout(() => navigate('/repair-settlement'), andPrintWorkList ? 300 : 0);
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
          ✅ Đã lưu phiếu quyết toán. Đang quay lại danh sách…
        </div>
      )}

      {saveError && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#C62828' }}>
          ⚠️ {saveError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { icon: '👤', label: 'Cố vấn dịch vụ', value: user?.name || 'Cố vấn dịch vụ' },
          { icon: '🏢', label: 'Chi nhánh', value: user?.branchName || user?.branch || MOCK_BRANCH },
          { icon: '🕐', label: 'Ngày tiếp nhận', value: existingOrder?.date || nowStr, mono: true },
        ].map((b) => (
          <div key={b.label} style={{ background: 'var(--primary-very-light)', border: '1px solid var(--primary-light)', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{b.icon}</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{b.label}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-dark)', fontFamily: b.mono ? 'monospace' : undefined }}>{b.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 1: Khách hàng & xe */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">📋 Thông tin khách hàng & xe</span>
        </div>
        <div className="card-body">
          <div className="form-grid form-grid-2">
            <div>
              <div className="form-group" style={{ position: 'relative', marginBottom: 12 }}>
                <label className="form-label required">Tên khách hàng</label>
                <input className="form-input"
                  value={customerQuery}
                  onChange={(e) => { setCustomerQuery(e.target.value); cInfoSet('fullName', e.target.value); setIsFromLookup(false); setActiveField('customer'); setShowSuggestions(true); }}
                  onFocus={() => { setActiveField('customer'); setShowSuggestions(true); }}
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
                <input className="form-input" value={customerInfo.address} onChange={(e) => cInfoSet('address', e.target.value)} placeholder="Địa chỉ khách hàng" />
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label required">Điện thoại {isFromLookup && <span title="Đã che 1 phần để bảo mật dữ liệu cá nhân">🔒</span>}</label>
                  <input className="form-input"
                    value={isFromLookup ? maskLast4(customerInfo.phone) : customerInfo.phone}
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
                  <input className="form-input" value={customerInfo.taxCode} onChange={(e) => cInfoSet('taxCode', e.target.value)} placeholder="Mã số thuế" />
                </div>
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">CCCD {isFromLookup && <span title="Đã che 1 phần để bảo mật dữ liệu cá nhân">🔒</span>}</label>
                  <input className="form-input"
                    value={isFromLookup ? maskLast4(customerInfo.cccd) : customerInfo.cccd}
                    readOnly={isFromLookup}
                    onChange={(e) => { cInfoSet('cccd', e.target.value); setIsFromLookup(false); }}
                    placeholder="Số CCCD / CMND" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email {isFromLookup && <span title="Đã che 1 phần để bảo mật dữ liệu cá nhân">🔒</span>}</label>
                  <input className="form-input"
                    value={isFromLookup ? maskLast4(customerInfo.email) : customerInfo.email}
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
                  onChange={(e) => { setPlateQuery(e.target.value); vInfoSet('licensePlate', e.target.value); setIsFromLookup(false); setActiveField('plate'); setShowSuggestions(true); }}
                  onFocus={() => { setActiveField('plate'); setShowSuggestions(true); }}
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
                <input className="form-input" value={vehicleInfo.vehicleModel} onChange={(e) => vInfoSet('vehicleModel', e.target.value)} placeholder=" " />
              </div>
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Số khung</label>
                  <input className="form-input" value={vehicleInfo.frameNumber}
                    onChange={(e) => { vInfoSet('frameNumber', e.target.value); setIsFromLookup(false); setActiveField('frame'); setShowSuggestions(true); }}
                    onFocus={() => { setActiveField('frame'); setShowSuggestions(true); }}
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
                    onChange={(e) => { vInfoSet('engineNumber', e.target.value); setIsFromLookup(false); setActiveField('engine'); setShowSuggestions(true); }}
                    onFocus={() => { setActiveField('engine'); setShowSuggestions(true); }}
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
                  <input className="form-input" type="date" value={vehicleInfo.purchaseDate} onChange={(e) => vInfoSet('purchaseDate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Số Km hiện tại</label>
                  <input className="form-input" type="number" value={vehicleInfo.currentKm} onChange={(e) => vInfoSet('currentKm', e.target.value)} />
                </div>
              </div>
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
          <span className="card-title">🔧 Hạng mục công việc / phụ tùng</span>
          <button className="btn btn-secondary btn-sm" onClick={addItem}>➕ Thêm dòng</button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 320 }}>Tên hạng mục / gói combo</th>
                  <th style={{ width: 170 }}>Loại hình sửa chữa</th>
                  <th style={{ width: 190 }}>Hình thức thanh toán</th>
                  <th style={{ width: 90 }}>Đơn vị tính</th>
                  <th style={{ width: 70 }}>Số lượng</th>
                  <th style={{ width: 150 }}>Đơn giá</th>
                  <th style={{ width: 110 }}>Chiết khấu (%)</th>
                  <th style={{ width: 70 }}>Miễn phí</th>
                  <th style={{ width: 130 }}>Thành tiền</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const suggestion = catalogSuggestions[idx];
                  const hasSuggestions = activeCatalogIdx === idx && suggestion && (suggestion.packages?.length > 0 || suggestion.services?.length > 0);
                  return (
                  <tr key={idx}>
                    <td style={{ position: 'relative' }}>
                      <input className="form-input" style={{ fontSize: 12 }} value={item.description}
                        onChange={(e) => handleItemDescription(idx, e.target.value)}
                        onFocus={(e) => openCatalogDropdown(idx, e.target)}
                        onBlur={() => setTimeout(() => closeCatalogSuggestions(idx), 180)}
                        placeholder="Nhập tên hạng mục / gói combo..." />
                      {hasSuggestions && catalogDropdownRect && createPortal(
                        <div style={{ position: 'fixed', top: catalogDropdownRect.top, left: catalogDropdownRect.left, width: 440, maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 1000 }}>
                          {suggestion.packages?.length > 0 && (
                            <div>
                              <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--primary-dark)', background: 'var(--primary-very-light)' }}>🎁 Gói combo</div>
                              {suggestion.packages.map((pkg) => (
                                <div key={`pkg-${pkg.id}`} onMouseDown={() => selectCatalogPackage(idx, pkg)}
                                  style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--gray-100)' }}>
                                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg.name} <span style={{ color: 'var(--gray-500)', fontWeight: 400 }}>({pkg.items.length} hạng mục)</span></div>
                                  <div style={{ fontSize: 11, color: 'var(--gray-600)' }}>{formatCurrency(pkg.totalPrice)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {suggestion.services?.length > 0 && (
                            <div>
                              <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--primary-dark)', background: 'var(--primary-very-light)' }}>🔧 Hạng mục đơn lẻ</div>
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
                      <select className="form-select" style={{ fontSize: 12 }} value={item.lhsc} onChange={(e) => setItem(idx, 'lhsc', e.target.value)}>
                        {LHSC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="form-select" style={{ fontSize: 12 }} value={item.httt} onChange={(e) => setItem(idx, 'httt', e.target.value)}>
                        {HTTT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input className="form-input" style={{ fontSize: 12 }} value={item.unit} onChange={(e) => setItem(idx, 'unit', e.target.value)} />
                    </td>
                    <td>
                      <input className="form-input" style={{ fontSize: 12 }} type="number" min={1} value={item.qty} onChange={(e) => setItem(idx, 'qty', Number(e.target.value))} />
                    </td>
                    <td>
                      <input className="form-input" style={{ fontSize: 12 }}
                        value={(item.unitPrice || 0).toLocaleString('vi-VN')} readOnly
                        title="Đơn giá lấy theo catalog, không chỉnh sửa trực tiếp trên form" />
                    </td>
                    <td>
                      <input className="form-input" style={{ fontSize: 12 }} type="number" min={0} max={100} value={item.discount} onChange={(e) => setItem(idx, 'discount', Number(e.target.value))} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={item.isFree} onChange={(e) => setItem(idx, 'isFree', e.target.checked)} />
                    </td>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{(item.total || 0).toLocaleString('vi-VN')}</td>
                    <td>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(idx)} title="Xóa dòng">🗑️</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Lịch bảo dưỡng kế tiếp */}
        <div className="card">
          <div className="card-header"><span className="card-title">🔔 Lịch bảo dưỡng kế tiếp</span></div>
          <div className="card-body">
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">Số Km kế tiếp</label>
                <input className="form-input" type="number" value={nextKm} onChange={(e) => setNextKm(e.target.value)} placeholder="Ví dụ: 47000" />
              </div>
              <div className="form-group">
                <label className="form-label">Ngày kế tiếp</label>
                <input className="form-input" placeholder="dd/mm/yyyy" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Tổng kết */}
        <div className="card" style={{ position: 'sticky', top: 70, alignSelf: 'start' }}>
          <div className="card-header"><span className="card-title">💰 Tổng kết thanh toán</span></div>
          <div className="card-body">
            <div className="summary-box" style={{ marginBottom: 14 }}>
              <div className="summary-row"><span>Tổng trước giảm giá:</span><span>{totals.subtotal.toLocaleString('vi-VN')} đ</span></div>
              <div className="summary-row"><span>Tổng giảm giá:</span><span>{totals.discountAmount.toLocaleString('vi-VN')} đ</span></div>
              <div className="summary-row"><span>Thuế GTGT (8%):</span><span>{totals.vat.toLocaleString('vi-VN')} đ</span></div>
              <div className="summary-row"><span>Miễn phí:</span><span>{totals.freeAmount.toLocaleString('vi-VN')} đ</span></div>
              <div className="summary-row total"><span>Tổng thanh toán:</span><span>{formatCurrency(totals.total)}</span></div>
            </div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--gray-600)', marginBottom: 14 }}>
              Bằng chữ: {numberToVietnamese(totals.total)}
            </div>

            {!canSave && (
              <div style={{ fontSize: 12, color: '#E65100', marginBottom: 8 }}>
                ⚠️ Vui lòng chọn khách hàng và xe từ gợi ý tra cứu để có thể lưu.
              </div>
            )}

            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
              disabled={!canSave || saving}
              onClick={() => handleSave(true)}>
              🖨️ Lưu & In danh sách công việc
            </button>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
              disabled={!canSave || saving}
              onClick={() => handleSave(false)}>
              💾 {saving ? 'Đang lưu…' : 'Lưu phiếu quyết toán'}
            </button>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={() => navigate('/repair-settlement')}>
              ← Quay lại
            </button>
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
