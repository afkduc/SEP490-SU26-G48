import { useEffect, useState } from 'react';
import { listRepairSettlementsApi } from '../../services/repairSettlementApi';
import { formatCurrency } from '../../utils';

// Tra cuu nhanh lich su vao xuong cua 1 chiec xe, mo ngay tren form tao phieu
// quyet toan.
//
// Truoc day muon biet chiec xe nay da tung lam gi thi co van phai roi form
// dang go do (mat het nhung gi vua nhap) sang man Lich su dich vu cua khach.
// Ma day la thu can biet DUNG LUC dang lap phieu: xe vua bao duong cach day 2
// tuan thi khong the lai ban goi bao duong nua; xe vao lan thu 3 cung 1 loi
// thi phai xem lan truoc tho lam gi.
//
// Dung lai API danh sach co san voi bo loc vehicleId - BE co y KHONG ap bo loc
// "phieu cua chinh minh" cho truong hop nay (xem buildConditions), vi 1 chiec
// xe co the da qua tay nhieu co van khac nhau.
export default function VehicleHistoryModal({ vehicleId, licensePlate, vehicleModel, excludeId, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let huy = false;
    listRepairSettlementsApi({ vehicleId, limit: 50 })
      .then((kq) => { if (!huy) setRows(kq.items || []); })
      .catch((err) => { if (!huy) setError(err.message || 'Không tải được lịch sử xe'); });
    return () => { huy = true; };
  }, [vehicleId]);

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
            <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C62828' }}>
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
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Số RO</th><th>Ngày tiếp nhận</th><th>Yêu cầu của khách</th>
                      <th>Tổ trưởng</th><th>Thợ sửa</th><th>Tổng tiền</th><th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {danhSach.map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.code}</td>
                        <td style={{ fontSize: 12 }}>{o.date}</td>
                        <td style={{ fontSize: 12, maxWidth: 260 }}>{o.customerRequest || '—'}</td>
                        <td style={{ fontSize: 12 }}>{o.teamLeader || '—'}</td>
                        <td style={{ fontSize: 12 }}>{o.technicianNames || '—'}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: '#C62828', whiteSpace: 'nowrap' }}>
                          {formatCurrency(o.total)}
                        </td>
                        <td style={{ fontSize: 12 }}>{o.status === 'cancelled' ? 'Đã hủy' : (o.status === 'invoiced' ? 'Đã xuất hóa đơn' : 'Đang xử lý')}</td>
                      </tr>
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
