import { Fragment, useEffect, useState } from 'react';
import { listRepairSettlementsApi, getRepairSettlementApi } from '../../services/repairSettlementApi';
import { formatCurrency } from '../../utils';
import { actionLabel } from '../../constants/maintenanceChecklist';
import { tachCongViecVaPhuTung } from './settlementItems';

// Tra cuu nhanh lich su vao xuong cua 1 chiec xe, mo ngay tren form tao phieu
// quyet toan.
//
// Truoc day muon biet chiec xe nay da tung lam gi thi co van phai roi form
// dang go (mat het nhung gi vua nhap) sang man Lich su dich vu cua khach.
// Ma day la thu can biet DUNG LUC dang lap phieu: xe vua bao duong cach day 2
// tuan thi khong the lai ban goi bao duong nua; xe vao lan thu 3 cung 1 loi
// thi phai xem lan truoc tho lam gi.
//
// Dung lai API danh sach co san voi bo loc vehicleId - BE co y KHONG ap bo loc
// "phieu cua chinh minh" cho truong hop nay (xem buildConditions), vi 1 chiec
// xe co the da qua tay nhieu co van khac nhau.

// Bung chi tiet NGAY TRONG bang thay vi mo them 1 modal chong len modal - o
// day dang la modal roi, chong them 1 lop nua thi bam Esc/bam ra ngoai khong
// biet dong cai nao.
function DongHangMuc({ item }) {
  return (
    <tr>
      <td>{item.description}</td>
      <td style={{ color: 'var(--gray-600)' }}>{actionLabel(item.actionCode) || '—'}</td>
      <td style={{ textAlign: 'center' }}>{item.qty}</td>
      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total)}</td>
    </tr>
  );
}

function ChiTietPhieu({ detail }) {
  const { congViec, phuTung } = tachCongViecVaPhuTung(detail.items);
  const dauMucDichVu = (detail.tasks || []).filter((t) => t.taskType === 'service');
  const soXong = dauMucDichVu.filter((t) => t.isDone).length;
  const khongDat = dauMucDichVu.filter((t) => t.checkResult === 'NG');

  return (
    <div style={{ padding: '10px 14px', background: 'var(--gray-50)' }}>
      {detail.cancelReason && (
        <div style={{ background: '#FFEBEE', borderRadius: 6, padding: '6px 10px', fontSize: 12.5, color: '#C62828', marginBottom: 10 }}>
          <b>Lý do hủy:</b> {detail.cancelReason}
        </div>
      )}

      {/* Dau muc "Khong dat" - thu dang gia nhat khi xem lai lich su: lan
          truoc tho da phat hien gi, khach dong y thay hay tu choi. */}
      {khongDat.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#C62828', marginBottom: 4 }}>
            {khongDat.length} hạng mục không đạt lần đó
          </div>
          {khongDat.map((t) => (
            <div key={t.id} style={{ fontSize: 12, marginBottom: 3, paddingLeft: 8, borderLeft: '2px solid #EF9A9A' }}>
              <b>{t.taskName}</b>
              {t.checkNote ? ` — thợ ghi: ${t.checkNote}` : ''}
              {t.ngDecision === 'accepted' && <span style={{ color: '#2E7D32' }}> · khách đồng ý thay</span>}
              {t.ngDecision === 'declined' && (
                <span style={{ color: 'var(--gray-600)' }}> · khách từ chối{t.ngNote ? `: ${t.ngNote}` : ''}</span>
              )}
              {t.ngDecision === 'resolved' && <span style={{ color: '#2E7D32' }}> · xưởng xử lý tại chỗ</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
        Hạng mục đã làm ({soXong}/{dauMucDichVu.length})
        {detail.technicians?.length > 0 && (
          <span style={{ fontWeight: 400, color: 'var(--gray-600)' }}>
            {'  ·  '}Thợ: {detail.technicians.map((t) => t.fullName).join(', ')}
          </span>
        )}
      </div>

      {/* Gop goi bao duong lai con 1 dong (dung ham chung voi ban in) va tach
          2 nhom nhu bang o form tao phieu - de lien mot mach thi khong biet
          dau la cong tho, dau la vat tu. */}
      <div style={{ maxHeight: 260, overflowY: 'auto', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6 }}>
        <table className="data-table" style={{ fontSize: 11.5 }}>
          <thead>
            <tr><th>Nội dung</th><th style={{ width: 130 }}>Yêu cầu</th><th style={{ width: 50 }}>SL</th><th style={{ width: 90 }}>Thành tiền</th></tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 11, padding: '4px 8px' }}>
                CÔNG VIỆC CẦN THỰC HIỆN
              </td>
            </tr>
            {congViec.map(({ item, i }) => <DongHangMuc key={`dv-${i}`} item={item} />)}
            {congViec.length === 0 && (
              <tr><td colSpan={4} style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Không có</td></tr>
            )}

            {phuTung.length > 0 && (
              <>
                <tr>
                  <td colSpan={4} style={{ background: 'var(--gray-200)', fontWeight: 700, fontSize: 11, padding: '4px 8px' }}>
                    PHỤ TÙNG, VẬT TƯ
                  </td>
                </tr>
                {phuTung.map(({ item, i }) => <DongHangMuc key={`pt-${i}`} item={item} />)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VehicleHistoryModal({ vehicleId, licensePlate, vehicleModel, excludeId, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  // Phieu dang bung + cache chi tiet da tai (bam dong roi mo lai khong goi API
  // lan nua).
  const [dangMo, setDangMo] = useState(null);
  const [chiTiet, setChiTiet] = useState({});
  const [dangTai, setDangTai] = useState(null);

  useEffect(() => {
    let huy = false;
    listRepairSettlementsApi({ vehicleId, limit: 50 })
      .then((kq) => { if (!huy) setRows(kq.items || []); })
      .catch((err) => { if (!huy) setError(err.message || 'Không tải được lịch sử xe'); });
    return () => { huy = true; };
  }, [vehicleId]);

  const moPhieu = async (id) => {
    if (dangMo === id) { setDangMo(null); return; }
    setDangMo(id);
    if (chiTiet[id]) return;
    setDangTai(id);
    try {
      const d = await getRepairSettlementApi(id);
      setChiTiet((prev) => ({ ...prev, [id]: d }));
    } catch (err) {
      setError(err.message || 'Không tải được chi tiết phiếu');
      setDangMo(null);
    } finally {
      setDangTai(null);
    }
  };

  // Bo chinh phieu dang sua ra khoi danh sach - no chua phai "lich su".
  const danhSach = (rows || []).filter((o) => String(o.id) !== String(excludeId));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg no-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            Lịch sử xe {licensePlate}
            {vehicleModel && <span style={{ fontWeight: 400, color: 'var(--gray-600)' }}> — {vehicleModel}</span>}
          </h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C62828', marginBottom: 10 }}>
              {error}
            </div>
          )}

          {!rows && !error && <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>Đang tải…</div>}

          {rows && !error && danhSach.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--gray-600)', fontStyle: 'italic' }}>
              Xe này chưa từng vào xưởng lần nào.
            </div>
          )}

          {danhSach.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--gray-600)', marginBottom: 8 }}>
                Đã vào xưởng <b>{danhSach.length}</b> lần. Gần nhất: <b>{danhSach[0].date}</b>
                {'  ·  '}<span style={{ fontStyle: 'italic' }}>Bấm vào một dòng để xem lần đó đã sửa những gì.</span>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 24 }}></th>
                      <th>Số RO</th><th>Ngày tiếp nhận</th><th>Chi nhánh</th>
                      <th>Tổng tiền</th><th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {danhSach.map((o) => (
                      <Fragment key={o.id}>
                        <tr onClick={() => moPhieu(o.id)} style={{ cursor: 'pointer' }}
                          title="Bấm để xem chi tiết lần sửa này">
                          <td style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: 10 }}>
                            <span style={{ display: 'inline-block', transition: 'transform .15s', transform: dangMo === o.id ? 'rotate(90deg)' : 'none' }}>▶</span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.code}</td>
                          <td style={{ fontSize: 12 }}>{o.date}</td>
                          <td style={{ fontSize: 12 }}>{o.branch || '—'}</td>
                          <td style={{ fontSize: 12, fontWeight: 700, color: '#C62828', whiteSpace: 'nowrap' }}>
                            {formatCurrency(o.total)}
                          </td>
                          <td style={{ fontSize: 12 }}>{o.status === 'cancelled' ? 'Đã hủy' : (o.status === 'invoiced' ? 'Đã xuất hóa đơn' : 'Đang xử lý')}</td>
                        </tr>
                        {dangMo === o.id && (
                          <tr>
                            <td colSpan={6} style={{ padding: 0 }}>
                              {dangTai === o.id
                                ? <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--gray-600)' }}>Đang tải chi tiết…</div>
                                : (chiTiet[o.id] && <ChiTietPhieu detail={chiTiet[o.id]} />)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
