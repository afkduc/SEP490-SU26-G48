import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { usePermission } from '../../contexts/PermissionContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import { formatCurrency, formatDate } from '../../utils';
import generalDirectorApi from '../../services/generalDirectorApi';

const GENERAL_DIRECTOR_ACTIONS = [
  {
    label: 'Phiếu quyết toán',
    path: '/general-director/reports/settlements',
    icon: '📑',
  },
  {
    label: 'Doanh thu',
    path: '/general-director/reports/revenue',
    icon: '📈',
  },
  {
    label: 'Nhân sự vận hành',
    path: '/general-director/employees',
    icon: '👥',
  },
  {
    label: 'Kỹ thuật viên',
    path: '/general-director/technicians',
    icon: '🛠️',
  },
  {
    label: 'DS giám đốc chi nhánh',
    path: '/general-director/branch-managers',
    icon: '🏢',
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
];

const TECHNICIAN_SKILL_OPTIONS = [
  { value: 'all', label: 'Tất cả kỹ năng' },
  { value: 'mechanical', label: 'Cơ khí' },
  { value: 'electrical', label: 'Điện - Điện tử' },
  { value: 'painting', label: 'Sơn - Đồng' },
  { value: 'diagnostic', label: 'Chuẩn đoán' },
  { value: 'maintenance', label: 'Bảo dưỡng' },
  { value: 'other', label: 'Khác' },
];

const EMPLOYEE_STATUS_META = {
  active: { label: 'Đang làm', color: '#0F766E', background: '#ECFDF5' },
  inactive: { label: 'Nghỉ', color: '#B91C1C', background: '#FEF2F2' },
};

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const FILTER_ROW_STYLE = {
  display: 'flex',
  gap: 10,
  flexWrap: 'nowrap',
  alignItems: 'center',
  overflowX: 'auto',
  paddingBottom: 4,
  whiteSpace: 'nowrap',
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

function repairStatusLabel(status) {
  const labels = {
    inprogress: 'Đang sửa chữa',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  };
  return labels[status] || status || 'Không rõ';
}

function percent(value) {
  const safeValue = Number(value || 0);
  return `${safeValue.toFixed(2)}%`;
}

function textIncludes(source, keyword) {
  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const text = normalize(source);
  const needle = normalize(keyword);
  if (!needle) return true;
  return text.includes(needle);
}

function paginateItems(items = [], page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const source = Array.isArray(items) ? items : [];
  const safePageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const total = source.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;

  return {
    total,
    totalPages,
    currentPage,
    items: source.slice(startIndex, startIndex + safePageSize),
  };
}

function buildPageItems(currentPage, totalPages) {
  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }
  return pages;
}

function DataPagination({ total, page, pageSize, onPageChange, onPageSizeChange, label, loading = false }) {
  if (!total) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);

  return (
    <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span className="pagination-info">Hiển thị {from}-{to} / {total} {label}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <select
          className="form-select"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          disabled={loading}
          style={{ height: 34, minWidth: 92 }}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}/trang</option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={loading || currentPage <= 1}
        >
          Trước
        </button>

        {buildPageItems(currentPage, totalPages).map((item, index) => (
          item === '...'
            ? <span key={`ellipsis-${index}`} style={{ color: '#94A3B8' }}>...</span>
            : (
              <button
                key={item}
                type="button"
                className={item === currentPage ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                onClick={() => onPageChange(item)}
                disabled={loading}
              >
                {item}
              </button>
            )
        ))}

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={loading || currentPage >= totalPages}
        >
          Sau
        </button>
      </div>
    </div>
  );
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
              <div style={{ fontSize: 12, opacity: 0.75 }}>Tổng giá trị thanh toán của phiếu.</div>
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
              <div style={{ fontWeight: 800 }}>{item.label}</div>
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
          <div className="breadcrumb">General Director / {title}</div>
        </div>
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
          <div style={{ fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', opacity: 0.75 }}>{title}</div>
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
  const [branchStatsPage, setBranchStatsPage] = useState(1);
  const [branchStatsPageSize, setBranchStatsPageSize] = useState(DEFAULT_PAGE_SIZE);
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
      setReport(response || {
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
        setBranches(response || []);
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
  const branchStatsPagination = paginateItems(branchStats, branchStatsPage, branchStatsPageSize);

  useEffect(() => {
    setBranchStatsPage(1);
  }, [branchId]);

  useEffect(() => {
    if (branchStatsPagination.currentPage !== branchStatsPage) {
      setBranchStatsPage(branchStatsPagination.currentPage);
    }
  }, [branchStatsPagination.currentPage, branchStatsPage]);

  const selectedBranchName = branchId === 'all'
    ? 'Tất cả chi nhánh'
    : branches.find((item) => String(item.id) === String(branchId))?.name || 'Chi nhánh';

  const maxRevenue = monthlyTrend.reduce((max, item) => Math.max(max, Number(item.totalRevenue || 0)), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Báo cáo doanh thu</h1>
          <div className="breadcrumb">General Director / Báo cáo doanh thu</div>
        </div>
        <div className="page-header-right">
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>👤 {user?.name || 'General Director'}</span>
        </div>
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '8px 0 8px', fontSize: 28, lineHeight: 1.15 }}>Tổng quan tài chính theo doanh thu đã chốt hóa đơn</h2>
            <p style={{ margin: 0, maxWidth: 760, color: 'rgba(255,255,255,0.8)' }}>
              Theo dõi tình hình doanh thu toàn hệ thống và lọc nhanh theo từng chi nhánh.
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

          {!loading && branchStatsPagination.total > 0 && (
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
                  {branchStatsPagination.items.map((row) => (
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
              <DataPagination
                total={branchStatsPagination.total}
                page={branchStatsPagination.currentPage}
                pageSize={branchStatsPageSize}
                onPageChange={setBranchStatsPage}
                onPageSizeChange={(size) => {
                  setBranchStatsPageSize(size);
                  setBranchStatsPage(1);
                }}
                label="chi nhánh"
                loading={loading}
              />
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
  const [employeeCodeFilter, setEmployeeCodeFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [branchId, setBranchId] = useState('all');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeEmployee, setActiveEmployee] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function loadBranches() {
      try {
        const response = await generalDirectorApi.getBranches();
        if (mounted) setBranches(response || []);
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
        setEmployees(response || []);
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

  useEffect(() => {
    setPage(1);
  }, [search, branchId, status, role, employeeCodeFilter, phoneFilter]);

  const filteredEmployees = employees.filter((employee) => {
    if (!textIncludes(employee.employeeId || employee.id, employeeCodeFilter)) return false;
    if (!textIncludes(employee.phone, phoneFilter)) return false;
    return true;
  });

  const employeePagination = paginateItems(filteredEmployees, page, pageSize);

  useEffect(() => {
    if (employeePagination.currentPage !== page) {
      setPage(employeePagination.currentPage);
    }
  }, [employeePagination.currentPage, page]);

  const openDetail = async (employee) => {
    setActiveEmployee(employee);
    setDetailError('');
    setDetailLoading(true);

    try {
      const response = await generalDirectorApi.getEmployeeById(employee.id);
      setActiveEmployee(response || employee);
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
          <div className="breadcrumb">General Director / Danh sách nhân sự</div>
        </div>
        <div className="page-header-right">
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>👤 {user?.name || 'General Director'}</span>
        </div>
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '8px 0 8px', fontSize: 28, lineHeight: 1.15 }}>Danh sách nhân sự toàn hệ thống</h2>
            <p style={{ margin: 0, maxWidth: 760, color: 'rgba(255,255,255,0.8)' }}>
              Theo dõi đầy đủ nhân sự các bộ phận ở mọi chi nhánh theo trạng thái hiện tại.
            </p>
          </div>
          <div style={{ minWidth: 240, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Tổng nhân sự</div>
            <div style={{ fontWeight: 900, fontSize: 28, marginTop: 4 }}>{filteredEmployees.length}</div>
            <div style={{ fontSize: 12, opacity: 0.72, marginTop: 8 }}>Đang làm</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{filteredEmployees.filter((item) => item.status === 'active').length}</div>
          </div>
        </div>
      </div>

      <div style={{ ...FILTER_ROW_STYLE, marginBottom: 12 }}>
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

        <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)} style={{ minWidth: 180, height: 42 }}>
          {EMPLOYEE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select className="form-select" value={role} onChange={(event) => setRole(event.target.value)} style={{ minWidth: 220, height: 42 }}>
          {EMPLOYEE_ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <input
          className="form-input"
          value={employeeCodeFilter}
          onChange={(event) => setEmployeeCodeFilter(event.target.value)}
          placeholder="Lọc mã nhân viên"
          style={{ minWidth: 180, height: 42 }}
        />

        <input
          className="form-input"
          value={phoneFilter}
          onChange={(event) => setPhoneFilter(event.target.value)}
          placeholder="Lọc số điện thoại"
          style={{ minWidth: 200, height: 42 }}
        />

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setSearch('');
            setEmployeeCodeFilter('');
            setPhoneFilter('');
            setBranchId('all');
            setStatus('all');
            setRole('all');
          }}
        >
          Xóa bộ lọc
        </button>
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
                    <p>Vui lòng chờ trong giây lát.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && employeePagination.total === 0 && !error && (
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

            {!loading && employeePagination.items.map((employee) => {
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

        <DataPagination
          total={employeePagination.total}
          page={employeePagination.currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          label="nhân sự"
          loading={loading}
        />
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
  const { user } = useAuth();
  const [technicians, setTechnicians] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [minActiveAssignments, setMinActiveAssignments] = useState('');
  const [branchId, setBranchId] = useState('all');
  const [skillGroup, setSkillGroup] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTechnician, setActiveTechnician] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  const reloadTechnicians = () => {
    setReloadTick((value) => value + 1);
  };

  const clearFilters = () => {
    setSearch('');
    setSpecialtyFilter('');
    setMinActiveAssignments('');
    setBranchId('all');
    setSkillGroup('all');
    setStatus('all');
  };

  useEffect(() => {
    let mounted = true;

    async function loadBranches() {
      try {
        const response = await generalDirectorApi.getBranches();
        if (mounted) setBranches(response || []);
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
        const response = await generalDirectorApi.getTechnicians({
          search: search.trim(),
          branchId,
          skillGroup,
          status,
        });

        if (seq !== requestSeq.current) return;
        setTechnicians(response || []);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setTechnicians([]);
        setError(err.message || 'Không tải được danh sách kỹ thuật viên');
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer.current);
  }, [search, branchId, skillGroup, status, reloadTick]);

  useEffect(() => {
    setPage(1);
  }, [search, branchId, skillGroup, status, specialtyFilter, minActiveAssignments]);

  const filteredTechnicians = technicians.filter((item) => {
    if (!textIncludes(item.specialty, specialtyFilter)) return false;
    if (minActiveAssignments !== '' && Number(item.activeAssignments || 0) < Number(minActiveAssignments || 0)) {
      return false;
    }
    return true;
  });

  const technicianPagination = paginateItems(filteredTechnicians, page, pageSize);

  useEffect(() => {
    if (technicianPagination.currentPage !== page) {
      setPage(technicianPagination.currentPage);
    }
  }, [technicianPagination.currentPage, page]);

  const openDetail = async (technician) => {
    setActiveTechnician(technician);
    setDetailError('');
    setDetailLoading(true);

    try {
      const response = await generalDirectorApi.getTechnicianById(technician.id);
      setActiveTechnician(response || technician);
    } catch (err) {
      setDetailError(err.message || 'Không tải được hồ sơ kỹ thuật viên');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setActiveTechnician(null);
    setDetailError('');
  };

  const selectedBranchName = branchId === 'all'
    ? 'Tất cả chi nhánh'
    : branches.find((branch) => String(branch.id) === String(branchId))?.name || 'Chi nhánh';
  const selectedSkillName = TECHNICIAN_SKILL_OPTIONS.find((option) => option.value === skillGroup)?.label || 'Tất cả kỹ năng';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Danh sách kỹ thuật viên</h1>
          <div className="breadcrumb">General Director / Danh sách kỹ thuật viên</div>
        </div>
        <div className="page-header-right">
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>👤 {user?.name || 'General Director'}</span>
        </div>
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '8px 0 8px', fontSize: 28, lineHeight: 1.15 }}>Điều phối kỹ thuật viên toàn hệ thống</h2>
            <p style={{ margin: 0, maxWidth: 760, color: 'rgba(255,255,255,0.8)' }}>
              Theo dõi kỹ thuật viên theo chi nhánh và nhóm kỹ năng chuyên môn.
            </p>
          </div>
          <div style={{ minWidth: 240, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Tổng kỹ thuật viên</div>
            <div style={{ fontWeight: 900, fontSize: 28, marginTop: 4 }}>{filteredTechnicians.length}</div>
            <div style={{ fontSize: 12, opacity: 0.72, marginTop: 8 }}>Đang làm</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{filteredTechnicians.filter((item) => item.status === 'active').length}</div>
          </div>
        </div>
      </div>

      <div style={{ ...FILTER_ROW_STYLE, marginBottom: 12 }}>
        <div className="search-input" style={{ minWidth: 320, flex: '1 1 320px' }}>
          <span className="search-icon">🔍</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã, tên, điện thoại, kỹ năng..."
          />
        </div>

        <select className="form-select" value={branchId} onChange={(event) => setBranchId(event.target.value)} style={{ minWidth: 220, height: 42 }}>
          <option value="all">Tất cả chi nhánh</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>

        <select className="form-select" value={skillGroup} onChange={(event) => setSkillGroup(event.target.value)} style={{ minWidth: 220, height: 42 }}>
          {TECHNICIAN_SKILL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)} style={{ minWidth: 180, height: 42 }}>
          {EMPLOYEE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <input
          className="form-input"
          value={specialtyFilter}
          onChange={(event) => setSpecialtyFilter(event.target.value)}
          placeholder="Lọc theo kỹ năng"
          style={{ minWidth: 200, height: 42 }}
        />

        <input
          className="form-input"
          type="number"
          min="0"
          value={minActiveAssignments}
          onChange={(event) => setMinActiveAssignments(event.target.value)}
          placeholder="Đang xử lý từ..."
          style={{ minWidth: 170, height: 42 }}
        />

        <button type="button" className="btn btn-secondary" onClick={clearFilters}>
          Xóa bộ lọc
        </button>
      </div>

      <div style={{ marginBottom: 12, fontSize: 12, color: '#64748B' }}>
        Đang lọc: {selectedBranchName} · {selectedSkillName}
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reloadTechnicians}>
            ↻ Tải lại
          </button>
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã nhân viên</th>
              <th>Họ và tên</th>
              <th>Chi nhánh</th>
              <th>Kỹ năng</th>
              <th>Đang xử lý</th>
              <th>Tổng lệnh</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state" style={{ minHeight: 220 }}>
                    <div className="empty-state-icon">⏳</div>
                    <h3>Đang tải danh sách kỹ thuật viên</h3>
                    <p>Vui lòng chờ trong giây lát.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && technicianPagination.total === 0 && !error && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <h3>Không có dữ liệu kỹ thuật viên</h3>
                    <p>Không tìm thấy kỹ thuật viên phù hợp với bộ lọc chi nhánh và kỹ năng.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && technicianPagination.items.map((technician) => {
              const badge = employeeStatusBadge(technician.status);
              return (
                <tr key={technician.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary-dark)' }}>{technician.employeeId || technician.id}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{technician.fullName || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{technician.phone || '—'}</div>
                  </td>
                  <td><BranchBadge branch={technician.branch} /></td>
                  <td>{technician.specialty || '—'}</td>
                  <td style={{ fontWeight: 800, color: '#0F766E' }}>{technician.activeAssignments || 0}</td>
                  <td style={{ fontWeight: 700 }}>{technician.totalRepairs || 0}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: badge.background, color: badge.color, fontSize: 12, fontWeight: 800 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-info btn-sm" onClick={() => openDetail(technician)}>
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <DataPagination
          total={technicianPagination.total}
          page={technicianPagination.currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          label="kỹ thuật viên"
          loading={loading}
        />
      </div>

      {(activeTechnician || detailLoading || detailError) && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal modal-lg" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 1000 }}>
            <div className="modal-header">
              <h3 className="modal-title">Chi tiết kỹ thuật viên</h3>
              <button className="modal-close" onClick={closeDetail}>✕</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '80vh', overflow: 'auto' }}>
              {detailLoading && (
                <div className="empty-state" style={{ minHeight: 220 }}>
                  <div className="empty-state-icon">⏳</div>
                  <h3>Đang tải hồ sơ kỹ thuật viên</h3>
                </div>
              )}

              {!detailLoading && detailError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px' }}>
                  {detailError}
                </div>
              )}

              {!detailLoading && !detailError && activeTechnician && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div style={{ background: '#EEF6FF', border: '1px solid #D7E7FF', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 12, color: '#54708A' }}>Mã nhân sự</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{activeTechnician.employeeId || '—'}</div>
                    </div>
                    <div style={{ background: '#F7F7F8', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>Chi nhánh</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 4 }}>{activeTechnician.branch?.name || '—'}</div>
                    </div>
                  </div>

                  <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, marginBottom: 10 }}>Hồ sơ kỹ thuật viên</div>
                    <DetailRow label="Họ và tên" value={activeTechnician.fullName} />
                    <DetailRow label="Email" value={activeTechnician.email} />
                    <DetailRow label="Số điện thoại" value={activeTechnician.phone} />
                    <DetailRow label="Trạng thái" value={employeeStatusBadge(activeTechnician.status).label} />
                    <DetailRow label="Chuyên môn" value={activeTechnician.specialty || '—'} />
                    <DetailRow label="Quy mô tổ" value={activeTechnician.teamSize ? `${activeTechnician.teamSize} người` : '—'} />
                    <DetailRow label="Ngày tạo tài khoản" value={formatDate(activeTechnician.createdAt)} />
                    <DetailRow label="Ghi chú" value={activeTechnician.notes} />
                  </div>

                  <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 800, marginBottom: 10 }}>Lịch sử sửa chữa</div>
                    <div className="table-wrapper" style={{ boxShadow: 'none', marginBottom: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Mã lệnh</th>
                            <th>Mã phiếu</th>
                            <th>Xe</th>
                            <th>Khách hàng</th>
                            <th>Trạng thái</th>
                            <th>Ngày tạo</th>
                            <th>Ngày hoàn thành</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(activeTechnician.repairHistory || []).length === 0 && (
                            <tr>
                              <td colSpan={7}>
                                <div className="empty-state" style={{ minHeight: 180 }}>
                                  <div className="empty-state-icon">📭</div>
                                  <h3>Chưa có lịch sử sửa chữa</h3>
                                </div>
                              </td>
                            </tr>
                          )}

                          {(activeTechnician.repairHistory || []).map((item) => (
                            <tr key={item.id}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{item.repairCode || '—'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{item.orderCode || '—'}</td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{item.vehicle?.licensePlate || '—'}</div>
                                <div style={{ fontSize: 11, color: '#6B7280' }}>{item.vehicle?.model || ''}</div>
                              </td>
                              <td>{item.customerName || '—'}</td>
                              <td>{repairStatusLabel(item.repairStatus)}</td>
                              <td>{formatDate(item.createdAt)}</td>
                              <td>{formatDate(item.completedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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

function BranchManagerListPage() {
  const { user } = useAuth();
  const { canScreenAction } = usePermission();
  const navigate = useNavigate();
  const canViewManagers = canScreenAction('director:branch_managers', 'view');
  const canCreateManager = canScreenAction('director:branch_managers', 'create');
  const canUpdateManager = canScreenAction('director:branch_managers', 'update');
  const canLockBranch = canScreenAction('director:branches', 'delete');
  const canUnlockBranch = canScreenAction('director:branches', 'update');
  const [branchManagers, setBranchManagers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [branchActiveFilter, setBranchActiveFilter] = useState('all');
  const [branchId, setBranchId] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  const loadBranches = async (mountedRef) => {
    try {
      const response = await generalDirectorApi.getBranches();
      if (!mountedRef || mountedRef.current) setBranches(response || []);
    } catch {
      if (!mountedRef || mountedRef.current) setBranches([]);
    }
  };

  const loadBranchManagers = async (overrides = {}) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');

    try {
      const response = await generalDirectorApi.getBranchManagers({
        search: overrides.search ?? search.trim(),
        branchId: overrides.branchId ?? branchId,
        status: overrides.status ?? status,
      });
      if (seq !== requestSeq.current) return;
      setBranchManagers(response || []);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setBranchManagers([]);
      setError(err.message || 'Không tải được danh sách giám đốc chi nhánh');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    const mountedRef = { current: true };
    loadBranches(mountedRef);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(() => {
      loadBranchManagers();
    }, 300);

    return () => clearTimeout(searchTimer.current);
  }, [search, branchId, status]);

  useEffect(() => {
    setPage(1);
  }, [search, branchId, status, emailFilter, branchActiveFilter]);

  const filteredManagers = branchManagers.filter((row) => {
    if (!textIncludes(row.email, emailFilter)) return false;
    if (branchActiveFilter === 'active' && row.branch?.isActive === false) return false;
    if (branchActiveFilter === 'inactive' && row.branch?.isActive !== false) return false;
    return true;
  });

  const managerPagination = paginateItems(filteredManagers, page, pageSize);

  useEffect(() => {
    if (managerPagination.currentPage !== page) {
      setPage(managerPagination.currentPage);
    }
  }, [managerPagination.currentPage, page]);

  const handleBranchActivation = async (row, nextActive) => {
    if (!row?.branch?.id) return;

    const actionLabel = nextActive ? 'kích hoạt lại' : 'ngưng hoạt động';
    const confirmed = window.confirm(
      nextActive
        ? `Kích hoạt lại chi nhánh ${row.branch.name}? Nhân sự thuộc chi nhánh này sẽ có thể đăng nhập lại.`
        : `Ngưng hoạt động chi nhánh ${row.branch.name}? Tất cả tài khoản thuộc chi nhánh này sẽ bị dừng hoạt động và các phiên đăng nhập hiện tại sẽ hết hiệu lực.`
    );
    if (!confirmed) return;

    setActionLoadingId(row.branch.id);
    setError('');

    try {
      if (nextActive) {
        await generalDirectorApi.reactivateBranch(row.branch.id);
      } else {
        await generalDirectorApi.deactivateBranch(row.branch.id);
      }
      await Promise.all([loadBranches(), loadBranchManagers()]);
    } catch (err) {
      setError(err.message || `Không thể ${actionLabel} chi nhánh`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Danh sách giám đốc chi nhánh</h1>
          <div className="breadcrumb">General Director / Danh sách giám đốc chi nhánh</div>
        </div>
        <div className="page-header-right">
          {canCreateManager && (
            <button type="button" className="btn btn-primary" onClick={() => navigate('/general-director/branch-managers/create')}>
              + Thêm Giám đốc chi nhánh
            </button>
          )}
        </div>
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '8px 0 8px', fontSize: 28, lineHeight: 1.15 }}>Danh sách giám đốc chi nhánh toàn hệ thống</h2>
            <p style={{ margin: 0, maxWidth: 760, color: 'rgba(255,255,255,0.8)' }}>
              Theo dõi giám đốc đang phụ trách từng chi nhánh và quản lý thay đổi nhân sự phụ trách.
            </p>
          </div>
          <div style={{ minWidth: 240, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Tổng giám đốc chi nhánh</div>
            <div style={{ fontWeight: 900, fontSize: 28, marginTop: 4 }}>{filteredManagers.length}</div>
            <div style={{ fontSize: 12, opacity: 0.72, marginTop: 8 }}>Đang hoạt động</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{filteredManagers.filter((item) => item.status === 'active').length}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>👤 {user?.name || 'General Director'}</div>
      </div>

      <div style={{ ...FILTER_ROW_STYLE, marginBottom: 12 }}>
        <div className="search-input" style={{ minWidth: 320, flex: '1 1 320px' }}>
          <span className="search-icon">🔍</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã, tên, email, điện thoại..." />
        </div>

        <select className="form-select" value={branchId} onChange={(event) => setBranchId(event.target.value)} style={{ minWidth: 220, height: 42 }}>
          <option value="all">Tất cả chi nhánh</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>

        <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)} style={{ minWidth: 180, height: 42 }}>
          {EMPLOYEE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <input
          className="form-input"
          value={emailFilter}
          onChange={(event) => setEmailFilter(event.target.value)}
          placeholder="Lọc email"
          style={{ minWidth: 200, height: 42 }}
        />

        <select
          className="form-select"
          value={branchActiveFilter}
          onChange={(event) => setBranchActiveFilter(event.target.value)}
          style={{ minWidth: 180, height: 42 }}
        >
          <option value="all">Tất cả trạng thái CN</option>
          <option value="active">CN hoạt động</option>
          <option value="inactive">CN bị khóa</option>
        </select>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setSearch('');
            setEmailFilter('');
            setBranchActiveFilter('all');
            setBranchId('all');
            setStatus('all');
          }}
        >
          Xóa bộ lọc
        </button>
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
              <th>Mã quản lý</th>
              <th>Họ và tên</th>
              <th>Chi nhánh</th>
              <th>Số điện thoại</th>
              <th>Email</th>
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
                    <h3>Đang tải danh sách giám đốc chi nhánh</h3>
                    <p>Vui lòng chờ trong giây lát.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && managerPagination.total === 0 && !error && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <h3>Không có dữ liệu giám đốc chi nhánh</h3>
                    <p>Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && managerPagination.items.map((row) => {
              const badge = employeeStatusBadge(row.status);
              const isBranchActive = row.branch?.isActive !== false;
              return (
                <tr key={row.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary-dark)' }}>{row.managerId || row.id}</td>
                  <td style={{ fontWeight: 700 }}>{row.fullName || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <BranchBadge branch={row.branch} />
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: isBranchActive ? '#ECFDF5' : '#FEF2F2', color: isBranchActive ? '#0F766E' : '#B91C1C', fontSize: 11, fontWeight: 800 }}>
                        {isBranchActive ? 'CN hoạt động' : 'CN bị khóa'}
                      </span>
                    </div>
                  </td>
                  <td>{row.phone || '—'}</td>
                  <td>{row.email || '—'}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: badge.background, color: badge.color, fontSize: 12, fontWeight: 800 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {canViewManagers && (
                      <button type="button" className="btn btn-info btn-sm" onClick={() => navigate(`/general-director/branch-managers/${row.id}`)}>
                        Xem
                      </button>
                    )}
                    {canUpdateManager && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/general-director/branch-managers/${row.id}/edit`)}>
                        Sửa
                      </button>
                    )}
                    {((isBranchActive && canLockBranch) || (!isBranchActive && canUnlockBranch)) && (
                      <button
                        type="button"
                        className={isBranchActive ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
                        onClick={() => handleBranchActivation(row, !isBranchActive)}
                        disabled={!row.branch?.id || actionLoadingId === row.branch?.id}
                      >
                        {actionLoadingId === row.branch?.id
                          ? 'Đang xử lý...'
                          : isBranchActive
                            ? 'Khóa chi nhánh'
                            : 'Mở chi nhánh'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <DataPagination
          total={managerPagination.total}
          page={managerPagination.currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          label="giám đốc chi nhánh"
          loading={loading}
        />
      </div>
    </div>
  );
}

function BranchManagerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canScreenAction } = usePermission();
  const canUpdateManager = canScreenAction('director:branch_managers', 'update');
  const [manager, setManager] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadDetail() {
      setLoading(true);
      setError('');
      try {
        const response = await generalDirectorApi.getBranchManagerById(id);
        if (!mounted) return;
        setManager(response || null);
      } catch (err) {
        if (!mounted) return;
        setManager(null);
        setError(err.message || 'Không tải được chi tiết giám đốc chi nhánh');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDetail();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Chi tiết giám đốc chi nhánh</h1>
          <div className="breadcrumb">General Director / Chi tiết giám đốc chi nhánh</div>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/general-director/branch-managers')}>
            Quay về danh sách
          </button>
          {canUpdateManager && (
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/general-director/branch-managers/${id}/edit`)}>
              Chỉnh sửa
            </button>
          )}
        </div>
      </div>

      <ModuleActionBar />

      {loading && (
        <div className="empty-state" style={{ minHeight: 280, background: 'white', borderRadius: 16, border: '1px solid #E5E7EB' }}>
          <div className="empty-state-icon">⏳</div>
          <h3>Đang tải hồ sơ giám đốc chi nhánh</h3>
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px' }}>
          {error}
        </div>
      )}

      {!loading && !error && manager && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16 }}>
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Thông tin cá nhân</div>
            <DetailRow label="Mã quản lý" value={manager.managerId} />
            <DetailRow label="Họ tên" value={manager.fullName} />
            <DetailRow label="Email" value={manager.email} />
            <DetailRow label="Số điện thoại" value={manager.phone} />
          </div>
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Thông tin công việc</div>
            <DetailRow label="Chức vụ" value={manager.role?.label || 'Giám đốc chi nhánh'} />
            <DetailRow label="Chi nhánh" value={manager.branch?.name || '—'} />
            <DetailRow label="Trạng thái" value={employeeStatusBadge(manager.status).label} />
            <DetailRow label="Ngày tạo tài khoản" value={formatDate(manager.createdAt)} />
          </div>
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Thông tin tài khoản</div>
            <DetailRow label="Email đăng nhập" value={manager.email} />
            <DetailRow label="Vai trò" value={manager.role?.label || 'Giám đốc chi nhánh'} />
            <DetailRow label="Mã chi nhánh" value={manager.branch?.code || '—'} />
            <DetailRow label="Địa chỉ chi nhánh" value={manager.branch?.address || '—'} />
          </div>
        </div>
      )}
    </div>
  );
}

function BranchManagerCreatePage() {
  const navigate = useNavigate();
  const { canScreenAction } = usePermission();
  const canCreateManager = canScreenAction('director:branch_managers', 'create');
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    branchId: '',
    status: 'active',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadBranches() {
      setLoading(true);
      try {
        const response = await generalDirectorApi.getBranches();
        if (!mounted) return;
        setBranches(response || []);
      } catch (err) {
        if (!mounted) return;
        setBranches([]);
        setError(err.message || 'Không tải được danh sách chi nhánh');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBranches();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const created = await generalDirectorApi.createBranchManager(form);
      navigate(`/general-director/branch-managers/${created.id}`);
    } catch (err) {
      setError(err.message || 'Thêm giám đốc chi nhánh thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (!canCreateManager) {
    return <Navigate to="/general-director/branch-managers" replace />;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Thêm giám đốc chi nhánh</h1>
          <div className="breadcrumb">General Director / Thêm giám đốc chi nhánh</div>
        </div>
        <div className="page-header-right">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/general-director/branch-managers')}>
            Quay về danh sách
          </button>
        </div>
      </div>

      <ModuleActionBar />

      <form onSubmit={handleSubmit} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>Tài khoản đăng nhập của giám đốc chi nhánh sử dụng email trong hệ thống hiện tại.</div>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <div>
            <label className="form-label">Họ tên</label>
            <input className="form-input" value={form.fullName} onChange={handleChange('fullName')} placeholder="Nhập họ tên" />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input" value={form.email} onChange={handleChange('email')} placeholder="Nhập email" type="email" />
          </div>
          <div>
            <label className="form-label">Số điện thoại</label>
            <input className="form-input" value={form.phone} onChange={handleChange('phone')} placeholder="Nhập số điện thoại" />
          </div>
          <div>
            <label className="form-label">Chi nhánh phụ trách</label>
            <select className="form-select" value={form.branchId} onChange={handleChange('branchId')} disabled={loading}>
              <option value="">Chọn chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Mật khẩu</label>
            <input className="form-input" value={form.password} onChange={handleChange('password')} placeholder="Nhập mật khẩu" type="password" />
          </div>
          <div>
            <label className="form-label">Xác nhận mật khẩu</label>
            <input className="form-input" value={form.confirmPassword} onChange={handleChange('confirmPassword')} placeholder="Nhập lại mật khẩu" type="password" />
          </div>
          <div>
            <label className="form-label">Trạng thái</label>
            <select className="form-select" value={form.status} onChange={handleChange('status')}>
              <option value="active">Đang làm</option>
              <option value="inactive">Nghỉ</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/general-director/branch-managers')}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || loading}>
            {saving ? 'Đang lưu...' : 'Thêm Giám đốc'}
          </button>
        </div>
      </form>
    </div>
  );
}

function BranchManagerEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canScreenAction } = usePermission();
  const canUpdateManager = canScreenAction('director:branch_managers', 'update');
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    branchId: '',
    status: 'active',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [branchResponse, managerResponse] = await Promise.all([
          generalDirectorApi.getBranches(),
          generalDirectorApi.getBranchManagerById(id),
        ]);
        if (!mounted) return;
        setBranches(branchResponse || []);
        setForm({
          fullName: managerResponse?.fullName || '',
          email: managerResponse?.email || '',
          phone: managerResponse?.phone || '',
          branchId: managerResponse?.branch?.id ? String(managerResponse.branch.id) : '',
          status: managerResponse?.status || 'active',
        });
      } catch (err) {
        if (!mounted) return;
        setError(err.message || 'Không tải được thông tin giám đốc chi nhánh');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await generalDirectorApi.updateBranchManager(id, form);
      navigate(`/general-director/branch-managers/${id}`);
    } catch (err) {
      setError(err.message || 'Cập nhật giám đốc chi nhánh thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (!canUpdateManager) {
    return <Navigate to={`/general-director/branch-managers/${id}`} replace />;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Chỉnh sửa giám đốc chi nhánh</h1>
          <div className="breadcrumb">General Director / Chỉnh sửa giám đốc chi nhánh</div>
        </div>
        <div className="page-header-right">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/general-director/branch-managers/${id}`)}>
            Quay về chi tiết
          </button>
        </div>
      </div>

      <ModuleActionBar />

      <form onSubmit={handleSubmit} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18 }}>
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <div>
            <label className="form-label">Họ tên</label>
            <input className="form-input" value={form.fullName} onChange={handleChange('fullName')} disabled={loading} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input" value={form.email} onChange={handleChange('email')} disabled={loading} type="email" />
          </div>
          <div>
            <label className="form-label">Số điện thoại</label>
            <input className="form-input" value={form.phone} onChange={handleChange('phone')} disabled={loading} />
          </div>
          <div>
            <label className="form-label">Chi nhánh</label>
            <select className="form-select" value={form.branchId} onChange={handleChange('branchId')} disabled={loading}>
              <option value="">Chọn chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Trạng thái</label>
            <select className="form-select" value={form.status} onChange={handleChange('status')} disabled={loading}>
              <option value="active">Đang làm</option>
              <option value="inactive">Nghỉ</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/general-director/branch-managers/${id}`)}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || loading}>
            {saving ? 'Đang cập nhật...' : 'Cập nhật thông tin'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SettlementReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [plateFilter, setPlateFilter] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [status, setStatus] = useState('all');
  const [branchId, setBranchId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function loadBranches() {
      try {
        const response = await generalDirectorApi.getBranches();
        if (mounted) setBranches(response || []);
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
        setReports(response || []);
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

  useEffect(() => {
    setPage(1);
  }, [search, status, branchId, customerFilter, plateFilter, serviceTypeFilter, advisorFilter]);

  const filteredReports = reports.filter((item) => {
    if (!textIncludes(item.customer?.fullName, customerFilter)) return false;
    if (!textIncludes(item.vehicle?.licensePlate, plateFilter)) return false;
    if (!textIncludes(item.serviceType, serviceTypeFilter)) return false;
    if (!textIncludes(item.advisor?.name, advisorFilter)) return false;
    return true;
  });

  const reportPagination = paginateItems(filteredReports, page, pageSize);

  useEffect(() => {
    if (reportPagination.currentPage !== page) {
      setPage(reportPagination.currentPage);
    }
  }, [reportPagination.currentPage, page]);

  const stats = filteredReports.reduce(
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
      setActiveReport(response || report);
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
      </div>

      <ModuleActionBar />

      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: 'white', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', opacity: 0.75 }}>General Director</div>
            <h2 style={{ margin: '8px 0 8px', fontSize: 28, lineHeight: 1.15 }}>Xem tất cả phiếu quyết toán từ mọi chi nhánh</h2>
            <p style={{ margin: 0, maxWidth: 760, color: 'rgba(255,255,255,0.8)' }}>
              Theo dõi phiếu quyết toán trên toàn hệ thống với bộ lọc theo mã phiếu, khách hàng, trạng thái và chi nhánh.
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

      <div style={{ ...FILTER_ROW_STYLE, marginBottom: 14 }}>
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

        <input
          className="form-input"
          value={customerFilter}
          onChange={(event) => setCustomerFilter(event.target.value)}
          placeholder="Lọc khách hàng"
          style={{ minWidth: 200, height: 42 }}
        />

        <input
          className="form-input"
          value={plateFilter}
          onChange={(event) => setPlateFilter(event.target.value)}
          placeholder="Lọc biển số"
          style={{ minWidth: 170, height: 42 }}
        />

        <input
          className="form-input"
          value={serviceTypeFilter}
          onChange={(event) => setServiceTypeFilter(event.target.value)}
          placeholder="Lọc loại dịch vụ"
          style={{ minWidth: 190, height: 42 }}
        />

        <input
          className="form-input"
          value={advisorFilter}
          onChange={(event) => setAdvisorFilter(event.target.value)}
          placeholder="Lọc tư vấn"
          style={{ minWidth: 170, height: 42 }}
        />

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setSearch('');
            setCustomerFilter('');
            setPlateFilter('');
            setServiceTypeFilter('');
            setAdvisorFilter('');
            setStatus('all');
            setBranchId('all');
          }}
        >
          Xóa bộ lọc
        </button>
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
                    <h3>Đang tải dữ liệu</h3>
                    <p>Vui lòng chờ trong giây lát.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && reportPagination.total === 0 && !error && (
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

            {!loading && reportPagination.items.map((report) => {
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

        <DataPagination
          total={reportPagination.total}
          page={reportPagination.currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          label="phiếu"
          loading={loading}
        />
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
      <Route path="reports" element={<Navigate to="reports/revenue" replace />} />
      <Route path="settlements" element={<Navigate to="reports/settlements" replace />} />
      <Route path="branches" element={<Navigate to="branch-managers" replace />} />
      <Route
        path="reports/settlements"
        element={
          <ProtectedRoute permission="screen:director:settlements:access">
            <SettlementReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="reports/revenue"
        element={
          <ProtectedRoute permission="screen:director:reports:access">
            <RevenueOverviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="employees"
        element={
          <ProtectedRoute permission="screen:director:employees:access">
            <EmployeeListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="technicians"
        element={
          <ProtectedRoute permission="screen:director:technicians:access">
            <TechnicianListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="branch-managers"
        element={
          <ProtectedRoute permission="screen:director:branch_managers:access">
            <BranchManagerListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="branch-managers/create"
        element={
          <ProtectedRoute permission="screen:director:branch_managers:access">
            <BranchManagerCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="branch-managers/:id"
        element={
          <ProtectedRoute permission="screen:director:branch_managers:access">
            <BranchManagerDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="branch-managers/:id/edit"
        element={
          <ProtectedRoute permission="screen:director:branch_managers:access">
            <BranchManagerEditPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="reports/settlements" replace />} />
    </Routes>
  );
}