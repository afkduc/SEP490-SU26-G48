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
  { value: 'FAILED_LOGIN', label: 'Đăng nhập thất bại (FAILED_LOGIN)', color: 'danger' },
  { value: 'LOGOUT', label: 'Đăng xuất (LOGOUT)', color: 'gray' },
  { value: 'FORCE_LOGOUT', label: 'Buộc đăng xuất (FORCE_LOGOUT)', color: 'orange' },
  { value: 'CHANGE_PASSWORD', label: 'Đổi mật khẩu (CHANGE_PASSWORD)', color: 'teal' },
  { value: 'RESET_PASSWORD', label: 'Đặt lại mật khẩu (RESET_PASSWORD)', color: 'cyan' },
  { value: 'ASSIGN_ROLE', label: 'Gán vai trò (ASSIGN_ROLE)', color: 'indigo' },
  { value: 'REMOVE_ROLE', label: 'Xóa vai trò (REMOVE_ROLE)', color: 'rose' },
  { value: 'GRANT_SCREEN', label: 'Cấp quyền màn hình (GRANT_SCREEN)', color: 'success' },
  { value: 'REVOKE_SCREEN', label: 'Thu hồi quyền màn hình (REVOKE_SCREEN)', color: 'danger' },
  { value: 'BULK_TOGGLE', label: 'Cập nhật hàng loạt ma trận (BULK_TOGGLE)', color: 'info' },
  { value: 'SAVE_SCREEN_MATRIX', label: 'Lưu ma trận màn hình (SAVE_SCREEN_MATRIX)', color: 'indigo' },
  { value: 'SAVE_USER_SCREEN_PERMISSIONS', label: 'Lưu quyền riêng user', color: 'teal' },
  { value: 'APPROVE_PERMISSION_REQUEST', label: 'Duyệt yêu cầu cấp quyền', color: 'success' },
  { value: 'REJECT_PERMISSION_REQUEST', label: 'Từ chối yêu cầu cấp quyền', color: 'danger' },
  { value: 'EXPORT', label: 'Xuất dữ liệu (EXPORT)', color: 'green' },
  { value: 'IMPORT', label: 'Nhập dữ liệu (IMPORT)', color: 'amber' },
];

const ACTION_LABELS = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa / Vô hiệu hóa',
  DISABLE: 'Ngừng hoạt động',
  REACTIVATE: 'Kích hoạt lại',
  READ: 'Xem dữ liệu',
  LOGIN: 'Đăng nhập',
  FAILED_LOGIN: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  FORCE_LOGOUT: 'Buộc đăng xuất',
  CHANGE_PASSWORD: 'Đổi mật khẩu',
  RESET_PASSWORD: 'Đặt lại mật khẩu',
  ASSIGN_ROLE: 'Gán vai trò',
  REMOVE_ROLE: 'Thu hồi vai trò',
  EXPORT: 'Xuất dữ liệu',
  IMPORT: 'Nhập dữ liệu',
  GRANT_SCREEN: 'Cấp quyền màn hình',
  REVOKE_SCREEN: 'Thu hồi quyền màn hình',
  BULK_TOGGLE: 'Cập nhật hàng loạt ma trận',
  SAVE_SCREEN_MATRIX: 'Lưu ma trận quyền màn hình',
  SAVE_USER_SCREEN_PERMISSIONS: 'Lưu quyền riêng user',
  CLEAR_USER_SCREEN_PERMISSIONS: 'Xóa quyền riêng user',
  APPROVE_PERMISSION_REQUEST: 'Duyệt yêu cầu cấp quyền',
  REJECT_PERMISSION_REQUEST: 'Từ chối yêu cầu cấp quyền',
  PERMISSION_MATRIX_BULK: 'Cập nhật ma trận phân quyền',
};

const ACTION_CLASS = {
  CREATE: 'badge--success',
  UPDATE: 'badge--info',
  DELETE: 'badge--danger',
  READ: 'badge--slate',
  LOGIN: 'badge--purple',
  FAILED_LOGIN: 'badge--danger',
  LOGOUT: 'badge--secondary',
  FORCE_LOGOUT: 'badge--orange',
  CHANGE_PASSWORD: 'badge--teal',
  RESET_PASSWORD: 'badge--cyan',
  ASSIGN_ROLE: 'badge--indigo',
  REMOVE_ROLE: 'badge--rose',
  EXPORT: 'badge--green',
  IMPORT: 'badge--amber',
  GRANT_SCREEN: 'badge--success',
  REVOKE_SCREEN: 'badge--danger',
  BULK_TOGGLE: 'badge--info',
  SAVE_SCREEN_MATRIX: 'badge--indigo',
  SAVE_USER_SCREEN_PERMISSIONS: 'badge--teal',
  CLEAR_USER_SCREEN_PERMISSIONS: 'badge--rose',
  APPROVE_PERMISSION_REQUEST: 'badge--success',
  REJECT_PERMISSION_REQUEST: 'badge--danger',
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
  role_screen_permissions: 'Quyền màn hình theo vai trò',
  role_screen_matrix: 'Ma trận quyền màn hình',
  permission_request: 'Yêu cầu cấp quyền',
  role_security_mapping: 'Ánh xạ vai trò - bảo mật',
  permissions: 'Phân quyền chi tiết',
  service_categories: 'Danh mục dịch vụ',
  services: 'Dịch vụ',
  service_packages: 'Gói dịch vụ',
  service_package_items: 'Hạng mục gói dịch vụ',
  suppliers: 'Nhà cung cấp',
  products: 'Phụ tùng / Sản phẩm',
  inventory_transactions: 'Giao dịch kho',
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
  const [selectedLog, setSelectedLog] = useState(null);

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
              <AuditTable items={audit.data.items} onRowClick={setSelectedLog} />
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

      {/* Detail Modal */}
      {selectedLog && (
        <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────

function TableSkeleton({ rows }) {
  return (
    <table className="table">
        <colgroup>
          <col /><col /><col /><col /><col />
        </colgroup>
      <thead>
        <tr>
          <th>Người dùng</th>
          <th>Hành động</th>
          <th>Mô tả</th>
          <th>Chi nhánh</th>
          <th>Thời gian</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            {[...Array(5)].map((_, j) => (
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

function AuditTable({ items, onRowClick }) {
  if (!items || items.length === 0) {
    return (
      <table className="table">
        <colgroup>
          <col /><col /><col /><col /><col />
        </colgroup>
        <thead>
          <tr>
            <th>Người dùng</th>
            <th>Hành động</th>
            <th>Mô tả</th>
            <th>Chi nhánh</th>
            <th>Thời gian</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={5} className="table__empty">
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
          <col /><col /><col /><col /><col />
        </colgroup>
      <thead>
        <tr>
          <th>Người dùng</th>
          <th>Hành động</th>
          <th>Mô tả</th>
          <th>Chi nhánh</th>
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
            <tr key={item.id} onClick={() => onRowClick && onRowClick(item)} style={{ cursor: 'pointer' }} title="Nhấp để xem chi tiết">
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
              <td className="audit-logs__cell--branch">
                {item.branch_name || item.branchId || '—'}
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

// ─── Detail Modal ────────────────────────────────────────────────────

function JsonView({ data }) {
  if (!data) return <span className="audit-detail__json-empty">—</span>;
  try {
    const obj = typeof data === 'string' ? JSON.parse(data) : data;
    return (
      <pre className="audit-detail__json">{JSON.stringify(obj, null, 2)}</pre>
    );
  } catch {
    return <span className="audit-detail__json-empty">{String(data)}</span>;
  }
}

/**
 * Format old/new value thành dạng human-readable
 * VD: { status: 'active', branchId: 1 } → "Trạng thái: Hoạt động, Chi nhánh: CN-001"
 */
const FIELD_LABELS = {
  status: 'Trạng thái',
  branchId: 'Chi nhánh',
  roleId: 'Vai trò',
  phone: 'SĐT',
  firstName: 'Họ',
  lastName: 'Tên',
  fullName: 'Tên đầy đủ',
  email: 'Email',
  userName: 'Tên đăng nhập',
  specialtyId: 'Chuyên môn',
  name: 'Tên',
  branchName: 'Chi nhánh',
  roleName: 'Vai trò',
};

const STATUS_LABELS = {
  active: 'Hoạt động',
  inactive: 'Ngừng hoạt động',
  locked: 'Bị khóa',
};

function formatValue(key, value) {
  if (value === null || value === undefined) return '—';
  if (key === 'status') return STATUS_LABELS[value] || value;
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string' && value.length > 50) return value.slice(0, 50) + '...';
  return String(value);
}

function DiffView({ oldValue, newValue }) {
  const oldObj = oldValue ? (typeof oldValue === 'string' ? JSON.parse(oldValue) : oldValue) : null;
  const newObj = newValue ? (typeof newValue === 'string' ? JSON.parse(newValue) : newValue) : null;

  if (!oldObj && !newObj) return <span className="audit-detail__json-empty">—</span>;

  // Nếu là object đơn giản, hiển thị dạng bảng thay đổi
  const isSimpleObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.keys(obj).length <= 10;

  if (isSimpleObject(oldObj) && isSimpleObject(newObj)) {
    const allKeys = [...new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})])];
    const changes = allKeys.filter(k => {
      const oldVal = oldObj?.[k];
      const newVal = newObj?.[k];
      return oldVal !== newVal;
    });

    if (changes.length > 0) {
      return (
        <div className="audit-detail__diff-table">
          <table>
            <thead>
              <tr>
                <th>Trường</th>
                <th>Giá trị cũ</th>
                <th>Giá trị mới</th>
              </tr>
            </thead>
            <tbody>
              {changes.map(key => {
                const label = FIELD_LABELS[key] || key;
                return (
                  <tr key={key}>
                    <td className="diff-label">{label}</td>
                    <td className="diff-old">{formatValue(key, oldObj?.[key])}</td>
                    <td className="diff-new">{formatValue(key, newObj?.[key])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    // Không có thay đổi
    if (Object.keys(newObj || {}).length > 0) {
      return (
        <div className="audit-detail__diff-table">
          <table>
            <tbody>
              {Object.entries(newObj).map(([key, value]) => (
                <tr key={key}>
                  <td className="diff-label">{FIELD_LABELS[key] || key}</td>
                  <td colSpan={2}>{formatValue(key, value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  // Fallback: hiển thị JSON nếu không parse được
  return (
    <div className="audit-detail__diff-raw">
      {oldObj && (
        <div className="audit-detail__diff-col">
          <label>Giá trị cũ</label>
          <JsonView data={oldValue} />
        </div>
      )}
      {newObj && (
        <div className="audit-detail__diff-col">
          <label>Giá trị mới</label>
          <JsonView data={newValue} />
        </div>
      )}
    </div>
  );
}

function AuditLogDetailModal({ log, onClose }) {
  if (!log) return null;
  const t = formatLocal(log.logged_at);
  const userName = log.user_name || 'Hệ thống';
  const actionLabel = ACTION_LABELS[log.action] || log.action || 'Thao tác';
  const objectLabel = TABLE_NAME_VI[log.table_name] || log.entity_name || log.table_name || 'hệ thống';
  const summary = log.description
    || `${userName} đã ${String(actionLabel).toLowerCase()} trên ${String(objectLabel).toLowerCase()}${log.entity_code ? ` (${log.entity_code})` : ''}.`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content audit-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Chi tiết nhật ký</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{
            padding: '14px 16px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            marginBottom: 16,
            fontSize: 14,
            lineHeight: 1.55,
            color: '#334155',
          }}>
            {summary}
          </div>

          {/* Row 1: User + Action */}
          <div className="audit-detail__row">
            <div className="audit-detail__field">
              <label>Người thực hiện</label>
              <div className="audit-detail__value">
                <span className="audit-detail__avatar">
                  {(userName || '?').split(' ').filter(Boolean).slice(-2).map((p) => p[0]).join('').toUpperCase()}
                </span>
                <strong>{userName}</strong>
                {log.phone_number && <span className="audit-detail__phone">{log.phone_number}</span>}
              </div>
            </div>
            <div className="audit-detail__field">
              <label>Hành động</label>
              <div className="audit-detail__value">
                <span className={`badge ${ACTION_CLASS[log.action] || 'badge--secondary'}`}>
                  {actionLabel}
                </span>
              </div>
            </div>
            <div className="audit-detail__field">
              <label>Đối tượng</label>
              <div className="audit-detail__value">
                <strong>{objectLabel}</strong>
                {log.entity_code && <code className="audit-detail__code">{log.entity_code}</code>}
              </div>
            </div>
          </div>

          {/* Row 2: IP + Method + Status + Duration */}
          <div className="audit-detail__row audit-detail__row--secondary">
            {log.ip_address && (
              <div className="audit-detail__field">
                <label>Địa chỉ IP</label>
                <code className="audit-detail__ip">{log.ip_address}</code>
              </div>
            )}
            {log.request_method && (
              <div className="audit-detail__field">
                <label>Method</label>
                <span className={`badge badge--${log.request_method === 'POST' ? 'success' : log.request_method === 'PUT' || log.request_method === 'PATCH' ? 'info' : log.request_method === 'DELETE' ? 'danger' : 'secondary'}`}>
                  {log.request_method}
                </span>
              </div>
            )}
            {log.request_url && (
              <div className="audit-detail__field audit-detail__field--full">
                <label>URL</label>
                <code className="audit-detail__url">{log.request_url}</code>
              </div>
            )}
            {log.response_status && (
              <div className="audit-detail__field">
                <label>HTTP Status</label>
                <span className={`badge badge--${String(log.response_status).startsWith('2') ? 'success' : String(log.response_status).startsWith('4') || String(log.response_status).startsWith('5') ? 'danger' : 'secondary'}`}>
                  {log.response_status}
                </span>
              </div>
            )}
            {log.duration_ms != null && (
              <div className="audit-detail__field">
                <label>Thời gian xử lý</label>
                <span className="audit-detail__duration">{log.duration_ms}ms</span>
              </div>
            )}
            {log.branch_name && (
              <div className="audit-detail__field">
                <label>Chi nhánh</label>
                <span>{log.branch_name}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {log.description && (
            <div className="audit-detail__section">
              <label>Mô tả</label>
              <p className="audit-detail__description">{log.description}</p>
            </div>
          )}

          {/* Old / New value */}
          {(log.old_value || log.new_value) && (
            <div className="audit-detail__diff">
              <DiffView oldValue={log.old_value} newValue={log.new_value} />
            </div>
          )}

          {/* Request body */}
          {log.request_body && (
            <div className="audit-detail__section">
              <label>Request Body</label>
              <JsonView data={log.request_body} />
            </div>
          )}

          {/* Timestamp */}
          <div className="audit-detail__timestamp">
            <span title={t.sub}>{t.main}</span>
            {log.record_id && <span className="audit-detail__record-id">Record ID: {log.record_id}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
