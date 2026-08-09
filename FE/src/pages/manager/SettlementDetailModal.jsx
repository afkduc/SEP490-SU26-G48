import { formatCurrency, formatDateTime } from '../../utils';

// Tach rieng khoi ManagerPage.jsx de dung chung duoc voi ManagerDashboardPage.jsx
// (modal "phieu da thanh toan trong thang" khi bam vao diem tren bieu do Doanh
// thu theo thang) - tranh import vong (ManagerPage da import ManagerDashboardPage).

export const SETTLEMENT_STATUS_META = {
  waiting_repair: { label: 'Chờ sửa chữa', color: '#E65100', background: '#FFF3E0' },
  inprogress: { label: 'Đang sửa chữa', color: '#1565C0', background: '#E3F2FD' },
  waiting_payment: { label: 'Chờ thanh toán', color: '#2E7D32', background: '#E8F5E9' },
  invoiced: { label: 'Đã xuất hóa đơn', color: '#424242', background: '#F5F5F5' },
  cancelled: { label: 'Đã hủy', color: '#B91C1C', background: '#FEF2F2' },
};

export function settlementStatusBadge(status) {
  return SETTLEMENT_STATUS_META[status] || { label: status || 'Không rõ', color: '#334155', background: '#F1F5F9' };
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, padding: '7px 0', borderBottom: '1px solid #ECEFF1' }}>
      <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827' }}>{value || '—'}</div>
    </div>
  );
}

export default function SettlementDetailModal({ report, onClose }) {
  if (!report) return null;
  const badge = settlementStatusBadge(report.status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 1040 }}>
        <div className="modal-header">
          <h3 className="modal-title">Chi tiết phiếu quyết toán {report.code}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '80vh', overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#EEF6FF', border: '1px solid #D7E7FF', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#54708A' }}>Mã phiếu</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{report.code}</div>
            </div>
            <div style={{ background: '#F7F7F8', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Chi nhánh</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 4 }}>{report.branch?.name || '—'}</div>
            </div>
            <div style={{ background: badge.background, border: `1px solid ${badge.color}33`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: badge.color }}>Trạng thái</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: badge.color, marginTop: 4 }}>{badge.label}</div>
            </div>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#9A3412' }}>Tổng thanh toán</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#C2410C', marginTop: 4 }}>{formatCurrency(report.total)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 18 }}>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Thông tin phiếu</div>
              <DetailRow label="Ngày tiếp nhận" value={formatDateTime(report.intakeDate)} />
              {report.status === 'cancelled' ? (
                <DetailRow label="Ngày hủy" value={report.cancelledAt ? formatDateTime(report.cancelledAt) : 'Không có dữ liệu'} />
              ) : (
                <>
                  <DetailRow label="Ngày hoàn thành" value={formatDateTime(report.completedDate)} />
                  <DetailRow
                    label="Ngày thanh toán"
                    value={
                      report.paidAt
                        ? formatDateTime(report.paidAt)
                        : report.status === 'invoiced'
                          ? 'Không có dữ liệu hóa đơn'
                          : 'Chưa thanh toán'
                    }
                  />
                </>
              )}
              <DetailRow label="Tư vấn dịch vụ" value={`${report.advisor?.name || '—'}${report.advisor?.phone ? ` · ${report.advisor.phone}` : ''}`} />
              <DetailRow label="Tổ trưởng" value={report.teamLeader?.name || 'Chưa gán'} />
              <DetailRow label="Yêu cầu khách hàng" value={report.customerRequest} />
              <DetailRow
                label="Hình thức thanh toán"
                value={
                  report.status !== 'invoiced'
                    ? 'Chưa thanh toán'
                    : report.paymentMethod === 'transfer'
                      ? 'Chuyển khoản (PayOS)'
                      : 'Tiền mặt'
                }
              />
            </div>

            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Khách hàng & xe</div>
              <DetailRow label="Khách hàng" value={report.customer?.fullName} />
              <DetailRow label="Điện thoại" value={report.customer?.phone} />
              <DetailRow label="Địa chỉ" value={report.customer?.address} />
              <DetailRow label="Biển số" value={report.vehicle?.licensePlate} />
              <DetailRow label="Dòng xe / Năm" value={`${report.vehicle?.vehicleModel || '—'}${report.vehicle?.manufactureYear ? ` · ${report.vehicle.manufactureYear}` : ''}`} />
              <DetailRow label="Số khung / số máy" value={`${report.vehicle?.frameNumber || '—'} / ${report.vehicle?.engineNumber || '—'}`} />
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Bảng hạng mục</div>
            <div className="table-wrapper" style={{ boxShadow: 'none', marginBottom: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Nội dung</th>
                    <th>Loại</th>
                    <th>HTTT</th>
                    <th>ĐVT</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th>CK %</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.items || []).length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state" style={{ minHeight: 160 }}>
                          <div className="empty-state-icon">📭</div>
                          <h3>Không có hạng mục</h3>
                        </div>
                      </td>
                    </tr>
                  )}
                  {(report.items || []).map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.code || '—'}</td>
                      <td>{item.description}</td>
                      <td>{item.lhsc || '—'}</td>
                      <td>{item.httt || '—'}</td>
                      <td>{item.unit || '—'}</td>
                      <td>{item.qty || 0}</td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td>{item.discount || 0}%</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Tổng hợp tài chính</div>
              <DetailRow label="Tổng trước giảm giá" value={formatCurrency(report.subtotal)} />
              <DetailRow label="Tổng giảm giá" value={formatCurrency(report.discountAmount)} />
              <DetailRow label="Tổng sau giảm giá" value={formatCurrency(report.afterDiscount)} />
              <DetailRow label="Thuế GTGT" value={formatCurrency(report.vat)} />
              <DetailRow label="Miễn phí" value={formatCurrency(report.freeAmount)} />
            </div>
            <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: 12, padding: 16, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Tổng thanh toán</div>
              <div style={{ fontSize: 28, fontWeight: 900, margin: '8px 0 6px' }}>{formatCurrency(report.total)}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Dữ liệu lấy trực tiếp từ SQL Server.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
