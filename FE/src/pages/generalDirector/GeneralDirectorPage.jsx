import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { formatCurrency, formatDate } from '../../utils';
import generalDirectorApi from '../../services/generalDirectorApi';

const GENERAL_DIRECTOR_ACTIONS = [
  {
    uc: 'UC-49',
    label: 'Phiếu quyết toán',
    path: '/general-director/reports/settlements',
    icon: '📑',
    description: 'Xem danh sách và chi tiết phiếu quyết toán của mọi chi nhánh.',
  },
  {
    uc: 'UC-49',
    label: 'Doanh thu',
    path: '/general-director/reports/revenue',
    icon: '📈',
    description: 'Xem tổng quan doanh thu toàn hệ thống hoặc theo từng chi nhánh.',
  },
  {
    uc: 'UC-50',
    label: 'Nhân sự vận hành',
    path: '/general-director/employees',
    icon: '👥',
    description: 'Xem danh sách toàn bộ nhân sự văn phòng và vận hành trên các chi nhánh.',
  },
  {
    uc: 'UC-51',
    label: 'Kỹ thuật viên',
    path: '/general-director/technicians',
    icon: '🛠️',
    description: 'Xem đội ngũ kỹ thuật theo chi nhánh và cấp độ tay nghề.',
  },
  {
    uc: 'UC-52',
    label: 'DS giám đốc chi nhánh',
    path: '/general-director/branch-managers',
    icon: '🏢',
    description: 'Vào màn danh sách để xem chi tiết, thêm mới và chỉnh sửa giám đốc chi nhánh.',
  },
];

const QUICK_LINK_STYLES = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #E5E7EB',
  background: 'white',
  color: '#111827',
  textDecoration: 'none',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'waiting_repair', label: 'Chờ sửa chữa' },
  { value: 'inprogress', label: 'Đang sửa chữa' },
  { value: 'waiting_payment', label: 'Chờ thanh toán' },
  { value: 'invoiced', label: 'Đã xuất hóa đơn' },
];

const STATUS_META = {
  waiting_repair: { label: 'Chờ sửa chữa', color: '#E65100', background: '#FFF3E0' },
  inprogress: { label: 'Đang sửa chữa', color: '#1565C0', background: '#E3F2FD' },
  waiting_payment: { label: 'Chờ thanh toán', color: '#2E7D32', background: '#E8F5E9' },
  invoiced: { label: 'Đã xuất hóa đơn', color: '#424242', background: '#F5F5F5' },
};

const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang làm' },
  { value: 'inactive', label: 'Nghỉ' },
];

const EMPLOYEE_ROLE_OPTIONS = [
  { value: 'all', label: 'Tất cả chức vụ' },
  { value: 'manager', label: 'Giám đốc chi nhánh' },
  { value: 'service_advisor', label: 'Cố vấn dịch vụ' },
  { value: 'team_leader', label: 'Tổ trưởng kỹ thuật' },
  { value: 'warehouse_staff', label: 'Nhân viên kho' },
  { value: 'accountant', label: 'Kế toán' },
];

const EMPLOYEE_STATUS_META = {
  active: { label: 'Đang làm', color: '#0F766E', background: '#ECFDF5' },
  inactive: { label: 'Nghỉ', color: '#B91C1C', background: '#FEF2F2' },
};

function statusBadge(status) {
  const meta = STATUS_META[status] || STATUS_META.waiting_repair;
  return {
    ...meta,
    label: meta.label,
  };
}

function currency(value) {
  return formatCurrency(value || 0);
}

function employeeStatusBadge(status) {
  return EMPLOYEE_STATUS_META[status] || { label: status || 'Không rõ', color: '#334155', background: '#F1F5F9' };
}

function percent(value) {
  const safeValue = Number(value || 0);
  return `${safeValue.toFixed(2)}%`;
}

function BranchBadge({ branch }) {
  if (!branch) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: '#F3F4F6', color: '#374151', fontSize: 12, fontWeight: 600 }}>
      🏢 {branch.name}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, padding: '7px 0', borderBottom: '1px solid #ECEFF1' }}>
      <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827' }}>{value || '—'}</div>
    </div>
  );
}

function DetailModal({ report, onClose }) {
  if (!report) return null;
  const badge = statusBadge(report.status);

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
              <div style={{ fontSize: 18, fontWeight: 800, color: '#C2410C', marginTop: 4 }}>{currency(report.total)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 18 }}>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Thông tin phiếu</div>
              <DetailRow label="Loại dịch vụ" value={report.serviceType} />
              <DetailRow label="Ngày tiếp nhận" value={formatDate(report.intakeDate)} />
              <DetailRow label="Ngày hoàn thành" value={formatDate(report.completedDate)} />
              <DetailRow label="Tư vấn dịch vụ" value={`${report.advisor?.name || '—'}${report.advisor?.phone ? ` · ${report.advisor.phone}` : ''}`} />
              <DetailRow label="Tổ trưởng" value={report.teamLeader?.name || 'Chưa gán'} />
              <DetailRow label="Yêu cầu khách hàng" value={report.customerRequest} />
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
                    <th>Miễn phí</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.items || []).length === 0 && (
                    <tr>
                      <td colSpan={10}>
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
                      <td>{currency(item.unitPrice)}</td>
                      <td>{item.discount || 0}%</td>
                      <td>{item.isFree ? 'Có' : ''}</td>
                      <td style={{ fontWeight: 700 }}>{currency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Tổng hợp tài chính</div>
              <DetailRow label="Tổng trước giảm giá" value={currency(report.subtotal)} />
              <DetailRow label="Tổng giảm giá" value={currency(report.discountAmount)} />
              <DetailRow label="Tổng sau giảm giá" value={currency(report.afterDiscount)} />
              <DetailRow label="Thuế GTGT" value={currency(report.vat)} />
              <DetailRow label="Miễn phí" value={currency(report.freeAmount)} />
            </div>
            <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: 12, padding: 16, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Tổng thanh toán</div>
              <div style={{ fontSize: 28, fontWeight: 900, margin: '8px 0 6px' }}>{currency(report.total)}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Dữ liệu lấy trực tiếp từ SQL Server.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleActionBar() {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {GENERAL_DIRECTOR_ACTIONS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              ...QUICK_LINK_STYLES,
              border: isActive ? '1px solid #0F766E' : QUICK_LINK_STYLES.border,
              background: isActive ? 'linear-gradient(135deg, #ECFEFF 0%, #F0FDFA 100%)' : QUICK_LINK_STYLES.background,
              boxShadow: isActive ? '0 14px 28px rgba(15, 118, 110, 0.12)' : QUICK_LINK_STYLES.boxShadow,
            })}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#F3F4F6', display: 'grid', placeItems: 'center', fontSize: 18 }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0F766E', letterSpacing: 0.4 }}>{item.uc}</div>
              <div style={{ fontWeight: 800, marginTop: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{item.description}</div>
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function PlaceholderPanel({ title, uc, description, actions, children }) {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{title}</h1>
          <div className="breadcrumb">General Director / {uc} / {title}</div>
        </div>
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', opacity: 0.75 }}>{uc}</div>
        <h2 style={{ margin: '8px 0', fontSize: 28, lineHeight: 1.15 }}>{title}</h2>
        <p style={{ margin: 0, maxWidth: 760, color: 'rgba(255,255,255,0.82)' }}>{description}</p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.variant === 'secondary' ? 'btn btn-secondary' : 'btn btn-primary'}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>

      {children || (
        <div className="table-wrapper">
          <div className="empty-state" style={{ minHeight: 280 }}>
            <div className="empty-state-icon">🚧</div>
            <h3>Chưa cài nghiệp vụ cho màn hình này</h3>
            <p>Route và action điều hướng đã sẵn sàng để tiếp tục code chức năng ở bước sau.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueOverviewPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState({
    summary: {
      currentMonthTotalRevenue: 0,
      currentMonthServiceRevenue: 0,
      outstandingReceivables: 0,
      currentMonthLabel: '',
    },
    monthlyTrend: [],
    branchStats: [],
  });

  const loadRevenueReport = async (currentBranchId) => {
    setLoading(true);
    setError('');
    try {
      const response = await generalDirectorApi.getRevenueReports({
        branchId: currentBranchId,
      });
      setReport(response?.data || {
        summary: {},
        monthlyTrend: [],
        branchStats: [],
      });
    } catch (err) {
      setReport({
        summary: {
          currentMonthTotalRevenue: 0,
          currentMonthServiceRevenue: 0,
          outstandingReceivables: 0,
          currentMonthLabel: '',
        },
        monthlyTrend: [],
        branchStats: [],
      });
      setError(err.message || 'Không thể tải báo cáo doanh thu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const response = await generalDirectorApi.getBranches();
        if (!mounted) return;
        setBranches(response?.data || []);
      } catch {
        if (!mounted) return;
        setBranches([]);
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadRevenueReport(branchId);
  }, [branchId]);

  const summary = report?.summary || {};
  const monthlyTrend = report?.monthlyTrend || [];
  const branchStats = report?.branchStats || [];

  const selectedBranchName = branchId === 'all'
    ? 'Tất cả chi nhánh'
    : branches.find((item) => String(item.id) === String(branchId))?.name || 'Chi nhánh';

  const maxRevenue = monthlyTrend.reduce((max, item) => Math.max(max, Number(item.totalRevenue || 0)), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Báo cáo doanh thu</h1>
          <div className="breadcrumb">General Director / UC-49 / Báo cáo doanh thu toàn hệ thống</div>
        </div>
        <div className="page-header-right">
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>👤 {user?.name || 'General Director'}</span>
        </div>
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', opacity: 0.75 }}>UC49 - View Revenue Reports For All Branch</div>
            <h2 style={{ margin: '8px 0 8px', fontSize: 28, lineHeight: 1.15 }}>Tổng quan tài chính theo doanh thu đã chốt hóa đơn</h2>
            <p style={{ margin: 0, maxWidth: 760, color: 'rgba(255,255,255,0.8)' }}>
              Dữ liệu đọc trực tiếp từ SQL Server theo trạng thái đã xuất hóa đơn, có thể lọc theo từng chi nhánh hoặc xem toàn hệ thống.
            </p>
          </div>
          <div style={{ minWidth: 260, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 14 }}>
            <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>Chi nhánh</label>
            <select
              className="form-select"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              style={{ minWidth: 220, background: 'rgba(255,255,255,0.94)' }}
            >
              <option value="all">Tất cả chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78 }}>Đang xem: {selectedBranchName}</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadRevenueReport(branchId)}>
            ↻ Tải lại
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          {
            label: `Tổng doanh thu tháng ${summary.currentMonthLabel || ''}`.trim(),
            value: currency(summary.currentMonthTotalRevenue),
            color: '#0F766E',
            background: '#ECFEFF',
          },
          {
            label: 'Doanh thu dịch vụ',
            value: currency(summary.currentMonthServiceRevenue),
            color: '#1D4ED8',
            background: '#EFF6FF',
          },
          {
            label: 'Công nợ phải thu',
            value: currency(summary.outstandingReceivables),
            color: '#B45309',
            background: '#FFFBEB',
          },
        ].map((card) => (
          <div key={card.label} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8, color: card.color }}>{loading ? '...' : card.value}</div>
            <div style={{ height: 4, width: '100%', marginTop: 12, borderRadius: 999, background: card.background }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Doanh thu theo tháng</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Từ các phiếu đã xuất hóa đơn</div>
          </div>

          {loading && (
            <div className="empty-state" style={{ minHeight: 220 }}>
              <div className="empty-state-icon">⏳</div>
              <h3>Đang tải biểu đồ</h3>
            </div>
          )}

          {!loading && monthlyTrend.length === 0 && (
            <div className="empty-state" style={{ minHeight: 220 }}>
              <div className="empty-state-icon">📉</div>
              <h3>Chưa có dữ liệu biểu đồ</h3>
            </div>
          )}

          {!loading && monthlyTrend.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 10, alignItems: 'end', minHeight: 240 }}>
              {monthlyTrend.map((item) => {
                const barHeight = maxRevenue > 0 ? Math.max(12, Math.round((Number(item.totalRevenue || 0) / maxRevenue) * 180)) : 12;
                return (
                  <div key={item.month || item.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>{currency(item.totalRevenue)}</div>
                    <div style={{ height: 190, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div
                        title={`${item.label}: ${currency(item.totalRevenue)}`}
                        style={{
                          width: 32,
                          height: barHeight,
                          borderRadius: '10px 10px 4px 4px',
                          background: 'linear-gradient(180deg, #0EA5E9 0%, #0284C7 100%)',
                          boxShadow: '0 8px 14px rgba(3, 105, 161, 0.25)',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 6, fontWeight: 700 }}>{item.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Theo chi nhánh (tháng hiện tại)</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Service revenue, tổng doanh thu và tỷ trọng đóng góp.</div>

          {loading && (
            <div className="empty-state" style={{ minHeight: 220 }}>
              <div className="empty-state-icon">⏳</div>
              <h3>Đang tải thống kê chi nhánh</h3>
            </div>
          )}

          {!loading && branchStats.length === 0 && (
            <div className="empty-state" style={{ minHeight: 220 }}>
              <div className="empty-state-icon">📭</div>
              <h3>Không có dữ liệu chi nhánh</h3>
            </div>
          )}

          {!loading && branchStats.length > 0 && (
            <div className="table-wrapper" style={{ boxShadow: 'none', marginBottom: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Chi nhánh</th>
                    <th>Doanh thu DV</th>
                    <th>Tổng</th>
                    <th>Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody>
                  {branchStats.map((row) => (
                    <tr key={row.branch?.id || row.branch?.code}>
                      <td style={{ fontWeight: 700 }}>{row.branch?.name || '—'}</td>
                      <td>{currency(row.serviceRevenue)}</td>
                      <td style={{ fontWeight: 700 }}>{currency(row.totalRevenue)}</td>
                      <td>
                        <div style={{ minWidth: 110 }}>
                          <div style={{ fontWeight: 700 }}>{percent(row.percentage)}</div>
                          <div style={{ marginTop: 4, height: 6, borderRadius: 999, background: '#E5E7EB', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, Number(row.percentage || 0)))}%`, height: '100%', background: '#0EA5E9' }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeListPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('all');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeEmployee, setActiveEmployee] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function loadBranches() {
      try {
        const response = await generalDirectorApi.getBranches();
        if (mounted) setBranches(response?.data || []);
      } catch {
        if (mounted) setBranches([]);
      }
    }

    loadBranches();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError('');

      try {
        const response = await generalDirectorApi.getEmployees({
          search: search.trim(),
          branchId,
          status,
          role,
        });

        if (seq !== requestSeq.current) return;
        setEmployees(response?.data || []);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setEmployees([]);
        setError(err.message || 'Không tải được danh sách nhân sự');
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer.current);
  }, [search, branchId, status, role]);

  const openDetail = async (employee) => {
    setActiveEmployee(employee);
    setDetailError('');
    setDetailLoading(true);

    try {
      const response = await generalDirectorApi.getEmployeeById(employee.id);
      setActiveEmployee(response?.data || employee);
    } catch (err) {
      setDetailError(err.message || 'Không tải được hồ sơ nhân sự');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setActiveEmployee(null);
    setDetailError('');
  };

  const detailBadge = employeeStatusBadge(activeEmployee?.status);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Danh sách nhân sự</h1>
          <div className="breadcrumb">General Director / UC-50 / View All Employee For All Branch</div>
        </div>
        <div className="page-header-right">
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>👤 {user?.name || 'General Director'}</span>
        </div>
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', opacity: 0.75 }}>UC50 - View All Employee For All Branch</div>
            <h2 style={{ margin: '8px 0 8px', fontSize: 28, lineHeight: 1.15 }}>Danh sách nhân sự toàn hệ thống</h2>
            <p style={{ margin: 0, maxWidth: 760, color: 'rgba(255,255,255,0.8)' }}>
              Hiển thị đầy đủ nhân sự các phòng ban ở mọi chi nhánh, lấy trực tiếp từ SQL Server theo trạng thái tài khoản thực tế.
            </p>
          </div>
          <div style={{ minWidth: 240, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Tổng nhân sự</div>
            <div style={{ fontWeight: 900, fontSize: 28, marginTop: 4 }}>{employees.length}</div>
            <div style={{ fontSize: 12, opacity: 0.72, marginTop: 8 }}>Đang làm</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{employees.filter((item) => item.status === 'active').length}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input" style={{ minWidth: 320, flex: '1 1 320px' }}>
          <span className="search-icon">🔍</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm kiếm tên, mã..."
          />
        </div>

        <select className="form-select" value={branchId} onChange={(event) => setBranchId(event.target.value)} style={{ minWidth: 220, height: 42 }}>
          <option value="all">Tất cả chi nhánh</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>

        <button type="button" className="btn btn-secondary" onClick={() => setShowAdvanced((prev) => !prev)}>
          {showAdvanced ? 'Ẩn Filter' : 'Filter nâng cao'}
        </button>
      </div>

      {showAdvanced && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12 }}>
          <div>
            <label className="form-label">Trạng thái</label>
            <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Chức vụ</label>
            <select className="form-select" value={role} onChange={(event) => setRole(event.target.value)}>
              {EMPLOYEE_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã nhân viên</th>
              <th>Họ và tên</th>
              <th>Chức vụ</th>
              <th>Chi nhánh</th>
              <th>Số điện thoại</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state" style={{ minHeight: 220 }}>
                    <div className="empty-state-icon">⏳</div>
                    <h3>Đang tải danh sách nhân sự</h3>
                    <p>Dữ liệu đang được lấy trực tiếp từ SQL Server.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && employees.length === 0 && !error && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <h3>Không có dữ liệu nhân sự</h3>
                    <p>Không tìm thấy nhân sự phù hợp với từ khóa hoặc bộ lọc hiện tại.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && employees.map((employee) => {
              const badge = employeeStatusBadge(employee.status);
              return (
                <tr key={employee.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary-dark)' }}>{employee.employeeId || employee.id}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{employee.fullName || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{employee.email || '—'}</div>
                  </td>
                  <td>{employee.primaryRoleLabel || '—'}</td>
                  <td><BranchBadge branch={employee.branch} /></td>
                  <td>{employee.phone || '—'}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: badge.background, color: badge.color, fontSize: 12, fontWeight: 800 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-info btn-sm" onClick={() => openDetail(employee)}>
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">{employees.length} nhân sự</span>
        </div>
      </div>

      {(activeEmployee || detailLoading || detailError) && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <h3 className="modal-title">Chi tiết nhân sự</h3>
              <button className="modal-close" onClick={closeDetail}>✕</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '78vh', overflow: 'auto' }}>
              {detailLoading && (
                <div className="empty-state" style={{ minHeight: 220 }}>
                  <div className="empty-state-icon">⏳</div>
                  <h3>Đang tải hồ sơ nhân sự</h3>
                </div>
              )}

              {!detailLoading && detailError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px' }}>
                  {detailError}
                </div>
              )}

              {!detailLoading && !detailError && activeEmployee && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div style={{ background: '#EEF6FF', border: '1px solid #D7E7FF', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 12, color: '#54708A' }}>Mã nhân sự</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{activeEmployee.employeeId || '—'}</div>
                    </div>
                    <div style={{ background: '#F7F7F8', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>Chức vụ chính</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 4 }}>{activeEmployee.primaryRoleLabel || '—'}</div>
                    </div>
                    <div style={{ background: detailBadge.background, border: `1px solid ${detailBadge.color}33`, borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 12, color: detailBadge.color }}>Trạng thái</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: detailBadge.color, marginTop: 4 }}>{detailBadge.label}</div>
                    </div>
                  </div>

                  <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 800, marginBottom: 10 }}>Thông tin hồ sơ</div>
                    <DetailRow label="Họ và tên" value={activeEmployee.fullName} />
                    <DetailRow label="Email" value={activeEmployee.email} />
                    <DetailRow label="Số điện thoại" value={activeEmployee.phone} />
                    <DetailRow label="Chi nhánh" value={activeEmployee.branch?.name || 'Chưa phân chi nhánh'} />
                    <DetailRow label="Vai trò" value={(activeEmployee.roleLabels || []).join(', ') || '—'} />
                    <DetailRow label="Chuyên môn" value={activeEmployee.specialty} />
                    <DetailRow label="Quy mô tổ" value={activeEmployee.teamSize ? `${activeEmployee.teamSize} người` : '—'} />
                    <DetailRow label="Ngày tạo tài khoản" value={formatDate(activeEmployee.createdAt)} />
                    <DetailRow label="Ghi chú" value={activeEmployee.notes} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TechnicianListPage() {
  const navigate = useNavigate();

  return (
    <PlaceholderPanel
      title="Danh sách kỹ thuật viên"
      uc="UC-52"
      description="Màn hình riêng cho đội kỹ thuật, để sau này bổ sung phân loại nghề và cấp độ tay nghề theo chi nhánh."
      actions={[
        { label: 'Xem kỹ thuật viên', onClick: () => navigate('/general-director/technicians') },
        { label: 'Quay sang nhân viên vận hành', variant: 'secondary', onClick: () => navigate('/general-director/employees') },
      ]}
    />
  );
}

function BranchManagerListPage() {
  const navigate = useNavigate();

  const previewRows = [
    { id: 1, name: 'Nguyen Van A', branch: 'Chi nhánh Quận 1', username: 'gdc_q1' },
    { id: 2, name: 'Tran Thi B', branch: 'Chi nhánh Gò Vấp', username: 'gdc_gv' },
    { id: 3, name: 'Le Van C', branch: 'Chi nhánh Bình Thạnh', username: 'gdc_bt' },
  ];

  return (
    <PlaceholderPanel
      title="Danh sách giám đốc chi nhánh"
      uc="UC-53"
      description="Danh sách mẫu để bạn bấm qua các action xem chi tiết, thêm mới và chỉnh sửa giám đốc chi nhánh trước khi cài logic thật."
      actions={[
        { label: 'Thêm giám đốc chi nhánh', onClick: () => navigate('/general-director/branch-managers/create') },
      ]}
    >
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Chi nhánh</th>
              <th>Tài khoản</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 700 }}>{row.name}</td>
                <td>{row.branch}</td>
                <td>{row.username}</td>
                <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-info btn-sm" onClick={() => navigate('/general-director/branch-managers/detail')}>
                    Xem chi tiết
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/general-director/branch-managers/edit')}>
                    Chỉnh sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlaceholderPanel>
  );
}

function BranchManagerDetailPage() {
  const navigate = useNavigate();

  return (
    <PlaceholderPanel
      title="Chi tiết giám đốc chi nhánh"
      uc="UC-54"
      description="Màn hình đích cho action xem chi tiết từ danh sách giám đốc chi nhánh."
      actions={[
        { label: 'Quay về danh sách', onClick: () => navigate('/general-director/branch-managers') },
        { label: 'Sửa thông tin', variant: 'secondary', onClick: () => navigate('/general-director/branch-managers/edit') },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Thông tin cá nhân</div>
          <DetailRow label="Họ tên" value="Nguyen Van A" />
          <DetailRow label="Email" value="gdc.q1@autogara.vn" />
          <DetailRow label="Số điện thoại" value="0901 234 567" />
          <DetailRow label="Tài khoản" value="gdc_q1" />
        </div>
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Phân công quản lý</div>
          <DetailRow label="Chi nhánh" value="Chi nhánh Quận 1" />
          <DetailRow label="Ngày nhận nhiệm vụ" value="08/07/2026" />
          <DetailRow label="Trạng thái" value="Đang quản lý" />
        </div>
      </div>
    </PlaceholderPanel>
  );
}

function BranchManagerCreatePage() {
  const navigate = useNavigate();

  return (
    <PlaceholderPanel
      title="Thêm giám đốc chi nhánh"
      uc="UC-55"
      description="Form placeholder để nối luồng tạo mới giám đốc chi nhánh và cấp tài khoản hệ thống."
      actions={[
        { label: 'Lưu tạm giao diện', onClick: () => navigate('/general-director/branch-managers') },
        { label: 'Quay về danh sách', variant: 'secondary', onClick: () => navigate('/general-director/branch-managers') },
      ]}
    >
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <div>
            <label className="form-label">Họ tên</label>
            <input className="form-input" placeholder="Nhập họ tên" readOnly />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input" placeholder="Nhập email" readOnly />
          </div>
          <div>
            <label className="form-label">Tên đăng nhập</label>
            <input className="form-input" placeholder="Nhập username" readOnly />
          </div>
          <div>
            <label className="form-label">Mật khẩu</label>
            <input className="form-input" placeholder="Nhập mật khẩu" readOnly />
          </div>
          <div>
            <label className="form-label">Chi nhánh phụ trách</label>
            <select className="form-select" disabled>
              <option>Chọn chi nhánh</option>
            </select>
          </div>
          <div>
            <label className="form-label">Trạng thái</label>
            <select className="form-select" disabled>
              <option>Kích hoạt</option>
            </select>
          </div>
        </div>
      </div>
    </PlaceholderPanel>
  );
}

function BranchManagerEditPage() {
  const navigate = useNavigate();

  return (
    <PlaceholderPanel
      title="Chỉnh sửa giám đốc chi nhánh"
      uc="UC-56"
      description="Form placeholder để nối luồng cập nhật thông tin hoặc điều chuyển giám đốc sang chi nhánh khác."
      actions={[
        { label: 'Cập nhật giả lập', onClick: () => navigate('/general-director/branch-managers/detail') },
        { label: 'Quay về chi tiết', variant: 'secondary', onClick: () => navigate('/general-director/branch-managers/detail') },
      ]}
    >
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <div>
            <label className="form-label">Họ tên</label>
            <input className="form-input" defaultValue="Nguyen Van A" readOnly />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input" defaultValue="gdc.q1@autogara.vn" readOnly />
          </div>
          <div>
            <label className="form-label">Chi nhánh hiện tại</label>
            <input className="form-input" defaultValue="Chi nhánh Quận 1" readOnly />
          </div>
          <div>
            <label className="form-label">Điều chuyển sang</label>
            <select className="form-select" disabled>
              <option>Chọn chi nhánh mới</option>
            </select>
          </div>
        </div>
      </div>
    </PlaceholderPanel>
  );
}

function SettlementReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [branchId, setBranchId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function loadBranches() {
      try {
        const response = await generalDirectorApi.getBranches();
        if (mounted) setBranches(response?.data || []);
      } catch {
        if (mounted) setBranches([]);
      }
    }

    loadBranches();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError('');

      try {
        const response = await generalDirectorApi.getSettlementReports({
          search: search.trim(),
          status,
          branchId,
        });

        if (seq !== requestSeq.current) return;
        setReports(response?.data || []);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setReports([]);
        setError(err.message || 'Không tải được danh sách phiếu quyết toán');
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer.current);
  }, [search, status, branchId]);

  const stats = reports.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      acc.revenue += Number(item.total || 0);
      return acc;
    },
    { total: 0, waiting_repair: 0, inprogress: 0, waiting_payment: 0, invoiced: 0, revenue: 0 }
  );

  const openDetail = async (report) => {
    setLoadingDetail(true);
    setDetailError('');
    try {
      const response = await generalDirectorApi.getSettlementReportById(report.id);
      setActiveReport(response?.data || report);
    } catch (err) {
      setDetailError(err.message || 'Không tải được chi tiết phiếu quyết toán');
      setActiveReport(report);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setActiveReport(null);
    setDetailError('');
  };

  const branchLabel = branchId === 'all' ? 'Tất cả chi nhánh' : branches.find((item) => String(item.id) === String(branchId))?.name || 'Chi nhánh';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Báo cáo quyết toán sửa chữa</h1>
          <div className="breadcrumb">Trang chủ / Báo cáo quyết toán sửa chữa</div>
        </div>
        <div className="page-header-right">
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>👤 {user?.name || 'General Director'}</span>
        </div>
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', opacity: 0.75 }}>General Director</div>
            <h2 style={{ margin: '8px 0 8px', fontSize: 28, lineHeight: 1.15 }}>Xem tất cả phiếu quyết toán từ mọi chi nhánh</h2>
            <p style={{ margin: 0, maxWidth: 760, color: 'rgba(255,255,255,0.8)' }}>
              Dữ liệu được tải trực tiếp từ SQL Server, có tìm kiếm theo mã phiếu, biển số, khách hàng và lọc theo trạng thái/chi nhánh.
            </p>
          </div>
          <div style={{ minWidth: 240, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Chi nhánh đang xem</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginTop: 4 }}>{branchLabel}</div>
            <div style={{ fontSize: 12, opacity: 0.72, marginTop: 8 }}>Tổng doanh thu đang lọc</div>
            <div style={{ fontWeight: 900, fontSize: 24, marginTop: 4 }}>{currency(stats.revenue)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Tổng phiếu', value: stats.total, background: '#EEF2FF', color: '#4338CA' },
          { label: 'Chờ sửa chữa', value: stats.waiting_repair, background: '#FFF3E0', color: '#E65100' },
          { label: 'Đang sửa chữa', value: stats.inprogress, background: '#E3F2FD', color: '#1565C0' },
          { label: 'Chờ thanh toán', value: stats.waiting_payment, background: '#E8F5E9', color: '#2E7D32' },
        ].map((item) => (
          <div key={item.label} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{item.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6, color: item.color }}>{item.value}</div>
            <div style={{ height: 4, width: '100%', marginTop: 12, borderRadius: 999, background: item.background }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input" style={{ minWidth: 320, flex: '1 1 320px' }}>
          <span className="search-icon">🔍</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm mã phiếu, biển số, khách hàng, số điện thoại..."
          />
        </div>

        <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)} style={{ minWidth: 200, height: 42 }}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select className="form-select" value={branchId} onChange={(event) => setBranchId(event.target.value)} style={{ minWidth: 220, height: 42 }}>
          <option value="all">Tất cả chi nhánh</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Xe</th>
              <th>Khách hàng</th>
              <th>Loại dịch vụ</th>
              <th>Chi nhánh</th>
              <th>Tư vấn</th>
              <th>Tiếp nhận</th>
              <th>Hoàn thành</th>
              <th>Chi phí</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state" style={{ minHeight: 220 }}>
                    <div className="empty-state-icon">⏳</div>
                    <h3>Đang tải dữ liệu từ SQL Server</h3>
                    <p>Vui lòng chờ trong giây lát.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && reports.length === 0 && !error && (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <h3>Không tìm thấy phiếu quyết toán</h3>
                    <p>Không có dữ liệu khớp với từ khóa hoặc bộ lọc hiện tại.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && reports.map((report) => {
              const badge = statusBadge(report.status);
              return (
                <tr key={report.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary-dark)' }}>{report.code}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{report.vehicle?.licensePlate || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      {report.vehicle?.vehicleModel || '—'}{report.vehicle?.manufactureYear ? ` · ${report.vehicle.manufactureYear}` : ''}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{report.customer?.fullName || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{report.customer?.phone || '—'}</div>
                  </td>
                  <td>{report.serviceType}</td>
                  <td><BranchBadge branch={report.branch} /></td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{report.advisor?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{report.advisor?.phone || ''}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{formatDate(report.intakeDate)}</td>
                  <td style={{ fontSize: 12 }}>{formatDate(report.completedDate)}</td>
                  <td style={{ fontWeight: 800, color: '#C62828' }}>{currency(report.total)}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: badge.background, color: badge.color, fontSize: 12, fontWeight: 800 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-info btn-sm" onClick={() => openDetail(report)}>
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">{reports.length} phiếu</span>
        </div>
      </div>

      {detailError && (
        <div style={{ marginTop: 12, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', borderRadius: 10, padding: '12px 14px' }}>
          {detailError}
        </div>
      )}

      {loadingDetail && (
        <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', borderRadius: 10, padding: '12px 14px' }}>
          Đang tải chi tiết phiếu quyết toán...
        </div>
      )}

      {activeReport && <DetailModal report={activeReport} onClose={closeDetail} />}
    </div>
  );
}

export default function GeneralDirectorPage() {
  return (
    <Routes>
      <Route index element={<Navigate to="reports/settlements" replace />} />
      <Route path="reports/settlements" element={<SettlementReportsPage />} />
      <Route path="reports/revenue" element={<RevenueOverviewPage />} />
      <Route path="employees" element={<EmployeeListPage />} />
      <Route path="technicians" element={<TechnicianListPage />} />
      <Route path="branch-managers" element={<BranchManagerListPage />} />
      <Route path="branch-managers/detail" element={<BranchManagerDetailPage />} />
      <Route path="branch-managers/create" element={<BranchManagerCreatePage />} />
      <Route path="branch-managers/edit" element={<BranchManagerEditPage />} />
      <Route path="*" element={<Navigate to="reports/settlements" replace />} />
    </Routes>
  );
}