import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuditLogs } from '../../hooks/admin/useAuditLogs';
import { auditApi } from '../../services/auditApi';
import { downloadBlob } from '../../utils/downloadBlob';
import { useSharedBranches } from '../../contexts/SharedDataContext';
import { useToast } from '../../components/common/ToastContext';
import AdminPagination from './components/AdminPagination';
import './AuditLogsPage.css';

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'CREATE', label: 'Tạo mới (CREATE)', color: 'success' },
  { value: 'UPDATE', label: 'Cập nhật (UPDATE)', color: 'info' },
  { value: 'DELETE', label: 'Xóa (DELETE)', color: 'danger' },
  { value: 'READ', label: 'Xem dữ liệu (READ)', color: 'slate' },
  { value: 'LOGIN', label: 'Đăng nhập (LOGIN)', color: 'purple' },
  { value: 'LOGOUT', label: 'Đăng xuất (LOGOUT)', color: 'gray' },
  { value: 'FORCE_LOGOUT', label: 'Buộc đăng xuất (FORCE_LOGOUT)', color: 'orange' },
  { value: 'CHANGE_PASSWORD', label: 'Đổi mật khẩu (CHANGE_PASSWORD)', color: 'teal' },
  { value: 'RESET_PASSWORD', label: 'Đặt lại mật khẩu (RESET_PASSWORD)', color: 'cyan' },
  { value: 'ASSIGN_ROLE', label: 'Gán vai trò (ASSIGN_ROLE)', color: 'indigo' },
  { value: 'REMOVE_ROLE', label: 'Xóa vai trò (REMOVE_ROLE)', color: 'rose' },
  { value: 'EXPORT', label: 'Xuất dữ liệu (EXPORT)', color: 'green' },
  { value: 'IMPORT', label: 'Nhập dữ liệu (IMPORT)', color: 'amber' },
];

const ACTION_LABELS = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  READ: 'Xem dữ liệu',
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  FORCE_LOGOUT: 'Buộc đăng xuất',
  CHANGE_PASSWORD: 'Đổi mật khẩu',
  RESET_PASSWORD: 'Đặt lại mật khẩu',
  ASSIGN_ROLE: 'Gán vai trò',
  REMOVE_ROLE: 'Xóa vai trò',
  EXPORT: 'Xuất dữ liệu',
  IMPORT: 'Nhập dữ liệu',
};

const ACTION_CLASS = {
  CREATE: 'badge--success',
  UPDATE: 'badge--info',
  DELETE: 'badge--danger',
  READ: 'badge--slate',
  LOGIN: 'badge--purple',
  LOGOUT: 'badge--secondary',
  FORCE_LOGOUT: 'badge--orange',
  CHANGE_PASSWORD: 'badge--teal',
  RESET_PASSWORD: 'badge--cyan',
  ASSIGN_ROLE: 'badge--indigo',
  REMOVE_ROLE: 'badge--rose',
  EXPORT: 'badge--green',
  IMPORT: 'badge--amber',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '2xx', label: '2xx - Thành công' },
  { value: '4xx', label: '4xx - Lỗi client' },
  { value: '5xx', label: '5xx - Lỗi server' },
];

/**
 * Map tên bảng (table_name) sang tên tiếng Việt cho dễ hiểu.
 * BE vẫn giữ table_name là key chuẩn (customers, users, ...).
 * Đây chỉ là lớp ánh xạ hiển thị ở frontend.
 */
const TABLE_NAME_VI = {
  customers: 'Khách hàng',
  vehicles: 'Phương tiện',
  brands: 'Hãng xe',
  branches: 'Chi nhánh',
  users: 'Người dùng',
  user_role: 'Phân quyền người dùng',
  user_specialty: 'Chuyên môn nhân viên',
  user_devices: 'Thiết bị đăng nhập',
  user_notification_settings: 'Cài đặt thông báo',
  roles: 'Vai trò',
  role_permissions: 'Phân quyền theo vai trò',
  role_security_mapping: 'Ánh xạ vai trò - bảo mật',
  permissions: 'Phân quyền chi tiết',
  service_categories: 'Danh mục dịch vụ',
  services: 'Dịch vụ',
  service_packages: 'Gói dịch vụ',
  service_package_items: 'Hạng mục gói dịch vụ',
  suppliers: 'Nhà cung cấp',
  products: 'Phụ tùng / Sản phẩm',
  inventory_transactions: 'Giao dịch kho',
  contracts: 'Hợp đồng',
  appointments: 'Lịch hẹn',
  work_orders: 'Phiếu sửa chữa',
  work_order_items: 'Hạng mục phiếu sửa',
  repair_orders: 'Phiếu sửa chữa (Repair Order)',
  repair_order_tasks: 'Công việc sửa chữa',
  service_orders: 'Đơn dịch vụ',
  service_order_items: 'Hạng mục đơn dịch vụ',
  invoices: 'Hóa đơn',
  payments: 'Thanh toán',
  specialties: 'Chuyên môn',
  warranty_records: 'Lịch sử bảo hành',
  after_service_care: 'Chăm sóc sau dịch vụ',
  customer_feedback: 'Phản hồi khách hàng',
  maintenance_reminders: 'Lịch nhắc bảo dưỡng',
  vehicle_owners: 'Chủ phương tiện',
  import_requests: 'Yêu cầu nhập kho',
  import_request_items: 'Chi tiết nhập kho',
  export_requests: 'Yêu cầu xuất kho',
  export_request_items: 'Chi tiết xuất kho',
  entity_definitions: 'Định nghĩa đối tượng',
  login_sessions: 'Phiên đăng nhập',
  login_session_events: 'Sự kiện phiên đăng nhập',
  audit_logs: 'Nhật ký hệ thống',
  notifications: 'Thông báo',
};

function formatLocal(value) {
  if (!value) return { main: '—', sub: '', ago: '' };
  let d;
  if (value instanceof Date) {
    d = value;
  } else {
    const s = typeof value === 'string' ? value : String(value);
    const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
    d = new Date(hasTz ? s : `${s}Z`);
  }
  if (Number.isNaN(d.getTime())) return { main: String(value), sub: '', ago: '' };

  const main = d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const sub = d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const diffMs = Date.now() - d.getTime();
  const ago = humanizeAgo(diffMs);
  return { main, sub, ago };
}

function humanizeAgo(diffMs) {
  if (diffMs < 0) return 'vừa xong';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return 'vừa xong';
  if (sec < 60) return `${sec} giây trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} ngày trước`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} tháng trước`;
  return `${Math.floor(mo / 12)} năm trước`;
}

// ─── Icons ────────────────────────────────────────────────────────────

const IconLog = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconFilter = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
  </svg>
);

const IconTable = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
    <line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);

const IconCreate = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);

const IconUpdate = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconDelete = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IconTotal = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// ─── Stats Cards ────────────────────────────────────────────────────

function StatsCards({ stats, loading }) {
  const cards = [
    { icon: <IconTotal />, iconCls: 'stat-card__icon--gray', value: stats?.total || 0, label: 'Tổng bản ghi' },
    { icon: <IconCreate />, iconCls: 'stat-card__icon--green', value: stats?.create || 0, label: 'Tạo mới' },
    { icon: <IconUpdate />, iconCls: 'stat-card__icon--blue', value: stats?.update || 0, label: 'Cập nhật' },
    { icon: <IconDelete />, iconCls: 'stat-card__icon--red', value: stats?.delete || 0, label: 'Xóa' },
  ];

  return (
    <div className="admin-logs__stats">
      {cards.map((c, i) => (
        <div key={i} className="stat-card">
          <div className={`stat-card__icon ${c.iconCls}`}>{c.icon}</div>
          <div className="stat-card__content">
            <span className="stat-card__value">
              {loading ? '—' : c.value.toLocaleString('vi-VN')}
            </span>
            <span className="stat-card__label">{c.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────

function Pagination({ currentPage, totalPages, total, onChange, loading }) {
  return (
    <AdminPagination
      currentPage={currentPage}
      totalPages={totalPages}
      total={total}
      onChange={onChange}
      loading={loading}
      accent="indigo"
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function AuditLogsPage() {
  const toast = useToast();
  const audit = useAuditLogs();
  const { branches, branchesError } = useSharedBranches();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function handleExportExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await auditApi.exportAuditLogs(audit.params);
      downloadBlob(blob, 'audit_logs.xlsx');
    } catch (err) {
      setExportError(err.message || 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    audit.setParams(() => ({
      keyword: '',
      userName: '',
      phone: '',
      action: '',
      tableName: '',
      entityName: '',
      entityCode: '',
      ipAddress: '',
      requestMethod: '',
      responseStatus: '',
      startDate: '',
      endDate: '',
      branchId: undefined,
      page: 1,
      pageSize: 10,
    }));
  }

  const totalPages = audit.data.total > 0 ? Math.ceil(audit.data.total / (audit.data.pageSize || 10)) : 1;
  const hasFilters = audit.params.keyword || audit.params.userName || audit.params.phone ||
    audit.params.action || audit.params.entityName || audit.params.entityCode ||
    audit.params.ipAddress ||
    audit.params.startDate || audit.params.endDate ||
    (audit.params.branchId != null);

  return (
    <div className="admin-logs">
      {/* Header */}
      <div className="admin-logs__header">
        <div className="admin-logs__title-block">
          <div className="admin-logs__title-icon">
            <IconLog />
          </div>
          <div className="admin-logs__title-group">
            <h1>Nhật ký hoạt động</h1>
            <p className="admin-logs__subtitle">Theo dõi tất cả thao tác của người dùng trên hệ thống</p>
          </div>
        </div>
        <div className="admin-logs__actions">
          <button
            className="btn btn--primary"
            onClick={handleExportExcel}
            disabled={exporting || audit.loading}
            title="Xuất nhật ký (theo bộ lọc hiện tại) ra file Excel"
          >
            <IconDownload />
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {exportError && (
        <div className="admin-logs__error">
          <strong>Lỗi xuất Excel:</strong> {exportError}
        </div>
      )}

      {/* Stats Cards */}
      <StatsCards stats={audit.data.stats} loading={audit.loading} />

      {/* Filter Card */}
      <div className="admin-logs__filters">
        <div className="admin-logs__filter-header">
          <div className="admin-logs__filter-title">
            <IconFilter />
            Bộ lọc &amp; Tìm kiếm
          </div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Ẩn bộ lọc' : 'Mở rộng'}
          </button>
        </div>

        {/* Quick search - always visible */}
        <div className="admin-logs__quick-search">
          <div className="filter-field filter-field--search">
            <IconSearch />
            <input
              className="filter-field__input"
              type="text"
              placeholder="Tìm kiếm nhanh (tên, mã, mô tả, URL...)"
              value={audit.params.keyword || ''}
              onChange={(e) => audit.updateParam('keyword', e.target.value)}
            />
          </div>
        </div>

        {showFilters && (
          <div className="admin-logs__filter-body">
            <div className="filter-field">
              <label className="filter-field__label">Tên người dùng</label>
              <input
                className="filter-field__input"
                type="text"
                placeholder="Nhập tên người dùng..."
                value={audit.params.userName || ''}
                onChange={(e) => audit.updateParam('userName', e.target.value)}
              />
            </div>

            <div className="filter-field">
              <label className="filter-field__label">Số điện thoại</label>
              <input
                className="filter-field__input"
                type="text"
                placeholder="Nhập SĐT..."
                value={audit.params.phone || ''}
                onChange={(e) => audit.updateParam('phone', e.target.value)}
              />
            </div>

            <div className="filter-field">
              <label className="filter-field__label">Hành động</label>
              <select
                className="filter-field__select"
                value={audit.params.action || ''}
                onChange={(e) => audit.updateParam('action', e.target.value)}
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label className="filter-field__label">Địa chỉ IP</label>
              <input
                className="filter-field__input"
                type="text"
                placeholder="VD: 192.168.1.1"
                value={audit.params.ipAddress || ''}
                onChange={(e) => audit.updateParam('ipAddress', e.target.value)}
              />
            </div>

            <div className="filter-field">
              <label className="filter-field__label">Chi nhánh</label>
              <select
                className="filter-field__select"
                value={audit.params.branchId ?? ''}
                onChange={(e) => audit.updateParam('branchId', e.target.value ? Number(e.target.value) : undefined)}
                disabled={!!branchesError}
              >
                <option value="">
                  {branchesError ? `Lỗi: ${branchesError}` : 'Tất cả chi nhánh'}
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branchName}</option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label className="filter-field__label">Khoảng ngày</label>
              <div className="filter-field__date-group">
                <input
                  className="filter-field__input filter-field__input--date"
                  type="date"
                  value={audit.params.startDate || ''}
                  onChange={(e) => audit.updateParam('startDate', e.target.value)}
                  title="Từ ngày"
                />
                <span className="filter-field__date-sep">—</span>
                <input
                  className="filter-field__input filter-field__input--date"
                  type="date"
                  value={audit.params.endDate || ''}
                  onChange={(e) => audit.updateParam('endDate', e.target.value)}
                  title="Đến ngày"
                />
              </div>
            </div>
          </div>
        )}

        <div className="admin-logs__filter-actions">
          <div className="admin-logs__filter-results">
            {audit.data.total > 0 && (
              <>Tìm thấy <strong>{audit.data.total.toLocaleString('vi-VN')}</strong> nhật ký</>
            )}
          </div>
          <div className="admin-logs__filter-btns">
            {hasFilters && (
              <button className="btn btn--ghost btn--sm" onClick={resetFilters}>
                <IconRefresh />
                Đặt lại
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="admin-logs__table-card">
        <div className="admin-logs__table-header">
          <div className="admin-logs__table-title">
            <IconTable />
            Danh sách nhật ký
          </div>
        </div>

        {audit.loading ? (
          <div className="admin-logs__table-wrapper">
            <TableSkeleton rows={6} />
          </div>
        ) : audit.error ? (
          <div className="admin-logs__error">
            <strong>Lỗi:</strong> {audit.error.message || 'Không thể tải danh sách'}
          </div>
        ) : (
          <>
            <div className="admin-logs__table-wrapper">
              <AuditTable items={audit.data.items} />
            </div>
            <Pagination
              currentPage={audit.data.page || 1}
              totalPages={totalPages}
              total={audit.data.total}
              onChange={(page) => audit.updateParam('page', page)}
              loading={audit.loading}
            />
          </>
        )}
      </div>

    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────

function TableSkeleton({ rows }) {
  return (
    <table className="table">
        <colgroup>
          <col /><col /><col /><col />
        </colgroup>
      <thead>
        <tr>
          <th>Người dùng</th>
          <th>Hành động</th>
          <th>Mô tả</th>
          <th>Thời gian</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            {[...Array(4)].map((_, j) => (
              <td key={j}>
                <div className="skeleton-line" style={{ width: `${50 + Math.random() * 40}%` }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AuditTable({ items }) {
  if (!items || items.length === 0) {
    return (
      <table className="table">
        <colgroup>
          <col /><col /><col /><col />
        </colgroup>
        <thead>
          <tr>
            <th>Người dùng</th>
            <th>Hành động</th>
            <th>Mô tả</th>
            <th>Thời gian</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} className="table__empty">
              Không có nhật ký nào phù hợp với bộ lọc
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <table className="table">
        <colgroup>
          <col /><col /><col /><col />
        </colgroup>
      <thead>
        <tr>
          <th>Người dùng</th>
          <th>Hành động</th>
          <th>Mô tả</th>
          <th>Thời gian</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const t = formatLocal(item.logged_at);
          const userName = item.user_name || 'Hệ thống';
          const initials = userName.split(' ').filter(Boolean).slice(-2)
            .map((p) => p[0]).join('').toUpperCase() || '?';
          return (
            <tr key={item.id}>
              <td>
                <div className="audit-logs__user-cell" title={userName}>
                  <span className="audit-logs__user-avatar" aria-hidden="true">{initials}</span>
                  <div className="audit-logs__user-text">
                    <span className="audit-logs__user-name">{userName}</span>
                  </div>
                </div>
              </td>
              <td>
                {item.action ? (
                  <span className={`badge ${ACTION_CLASS[item.action] || 'badge--secondary'}`} title={item.action}>
                    {ACTION_LABELS[item.action] || item.action}
                  </span>
                ) : '—'}
              </td>
              <td>
                <span className="audit-logs__description" title={item.description || ''}>
                  {item.description || '—'}
                </span>
              </td>
              <td className="audit-logs__cell--time">
                <div className="audit-logs__time-cell">
                  <span className="audit-logs__time-main" title={t.main}>{t.main}</span>
                  <span className="audit-logs__time-ago">{t.ago}</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
