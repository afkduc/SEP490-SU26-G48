import { useState, useEffect, useMemo } from 'react';
import { useAuditLogs } from '../../hooks/admin/useAuditLogs';
import { auditApi } from '../../services/auditApi';
import { downloadBlob } from '../../utils/downloadBlob';
import { useSharedBranches } from '../../contexts/SharedDataContext';
import { useToast } from '../../components/common/ToastContext';
import AuditLogDetailDrawer from './AuditLogDetailDrawer';
import AdminPagination from './components/AdminPagination';
import './AuditLogsPage.css';

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'CREATE', label: 'Tạo mới (CREATE)' },
  { value: 'UPDATE', label: 'Cập nhật (UPDATE)' },
  { value: 'DELETE', label: 'Xóa (DELETE)' },
];

const ACTION_LABELS = { CREATE: 'Tạo mới', UPDATE: 'Cập nhật', DELETE: 'Xóa' };
const ACTION_CLASS = { CREATE: 'badge--success', UPDATE: 'badge--info', DELETE: 'badge--danger' };

/**
 * Map tên bảng (table_name) sang tên tiếng Việt cho dễ hiểu.
 * BE vẫn giữ table_name là key chuẩn (customers, users, ...).
 * Đây chỉ là lớp ánh xạ hiển thị ở frontend.
 */
const TABLE_NAME_VI = {
  customers:           'Khách hàng',
  users:               'Người dùng',
  user_roles:          'Vai trò người dùng',
  roles:               'Vai trò',
  permissions:         'Phân quyền',
  branches:            'Chi nhánh',
  appointments:        'Lịch hẹn',
  vehicles:            'Phương tiện',
  service_catalog:     'Danh mục dịch vụ',
  products:            'Phụ tùng / Sản phẩm',
  work_orders:         'Phiếu sửa chữa',
  work_order_items:    'Hạng mục phiếu sửa',
  invoices:            'Hóa đơn',
  payments:            'Thanh toán',
  inventory:           'Tồn kho',
  inventory_transactions: 'Giao dịch kho',
  login_sessions:      'Phiên đăng nhập',
  login_session_events:'Sự kiện phiên',
  audit_logs:          'Nhật ký hệ thống',
  notifications:       'Thông báo',
};

function viTableName(name) {
  if (!name) return '—';
  return TABLE_NAME_VI[name] || name;
}

/**
 * formatDate: trả về thời gian local (vi-VN) hiển thị ở cột "Thời gian".
 * - Ưu tiên dùng ISO với 'Z' để hiểu là UTC (fix vấn đề lệch giờ).
 * - Nếu BE trả về string không có timezone, coi như UTC vì DB đang lưu UTC.
 */
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

function getMethodClass(method) {
  if (!method) return 'method--default';
  const m = method.toUpperCase();
  if (m === 'GET') return 'method--GET';
  if (m === 'POST') return 'method--POST';
  if (m === 'PUT' || m === 'PATCH') return 'method--PUT';
  if (m === 'DELETE') return 'method--DELETE';
  return 'method--default';
}

function getResponseBadge(status) {
  if (status == null) return null;
  if (status >= 200 && status < 300) return { cls: 'badge--success', label: `${status} Thành công` };
  if (status >= 400 && status < 500) return { cls: 'badge--warning', label: `${status} Lỗi client` };
  if (status >= 500) return { cls: 'badge--danger', label: `${status} Lỗi server` };
  return { cls: 'badge--secondary', label: String(status) };
}

function formatDuration(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '—';
  const n = Number(ms);
  if (n < 1000) return `${n} ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(2)} s`;
  return `${Math.floor(n / 60_000)}m ${Math.floor((n % 60_000) / 1000)}s`;
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
    <line x1="12" y1="15" x2="12" y1="3"/>
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

const IconDoc = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
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

// ─── Stats Cards ────────────────────────────────────────────────────

function StatsCards({ items, loading }) {
  const counts = { total: 0, create: 0, update: 0, delete: 0 };
  if (items && items.length > 0) {
    counts.total = items.length;
    items.forEach((item) => {
      const a = (item.action || '').toUpperCase();
      if (a.includes('CREATE') || a.includes('INSERT')) counts.create++;
      else if (a.includes('UPDATE') || a.includes('EDIT')) counts.update++;
      else if (a.includes('DELETE') || a.includes('REMOVE')) counts.delete++;
    });
  }

  const cards = [
    { icon: <IconTotal />, iconCls: 'stat-card__icon--gray', value: counts.total, label: 'Tổng bản ghi' },
    { icon: <IconCreate />, iconCls: 'stat-card__icon--green', value: counts.create, label: 'Tạo mới' },
    { icon: <IconUpdate />, iconCls: 'stat-card__icon--blue', value: counts.update, label: 'Cập nhật' },
    { icon: <IconDelete />, iconCls: 'stat-card__icon--red', value: counts.delete, label: 'Xóa' },
  ];

  return (
    <div className="admin-logs__stats">
      {cards.map((c, i) => (
        <div key={i} className="stat-card">
          <div className={`stat-card__icon ${c.iconCls}`}>{c.icon}</div>
          <div className="stat-card__content">
            <span className="stat-card__value">
              {loading ? '—' : c.value}
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
  const [detailLog, setDetailLog] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick mỗi 30s để cột "x phút trước" tự cập nhật realtime (re-render nhẹ)
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
      userName: '',
      phone: '',
      action: '',
      entityName: '',
      entityCode: '',
      startDate: '',
      endDate: '',
      branchId: undefined,
      page: 1,
      pageSize: 10,
    }));
  }

  const totalPages = audit.data.total > 0 ? Math.ceil(audit.data.total / (audit.data.pageSize || 10)) : 1;
  const hasFilters = audit.params.userName || audit.params.phone || audit.params.action ||
    audit.params.entityCode || audit.params.startDate || audit.params.endDate ||
    (audit.params.branchId != null);

  // Chỉ render lại cột thời gian khi tick (không re-render toàn trang)
  const timeTick = useMemo(() => now, [now]);

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
      <StatsCards items={audit.data.items} loading={audit.loading} />

      {/* Filter Card */}
      <div className="admin-logs__filters">
        <div className="admin-logs__filter-header">
          <div className="admin-logs__filter-title">
            <IconFilter />
            Bộ lọc &amp; Tìm kiếm
          </div>
        </div>

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
            <label className="filter-field__label">Mã bản ghi</label>
            <input
              className="filter-field__input"
              type="text"
              placeholder="VD: KH-001, ND-005..."
              value={audit.params.entityCode || ''}
              onChange={(e) => audit.updateParam('entityCode', e.target.value)}
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

        <div className="admin-logs__filter-actions">
          <div className="admin-logs__filter-results">
            {audit.data.total > 0 && (
              <>Tìm thấy <strong>{audit.data.total}</strong> nhật ký</>
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
              <AuditTable
                items={audit.data.items}
                onViewLog={setDetailLog}
                timeTick={timeTick}
              />
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

      {/* Log detail drawer */}
      {detailLog && (
        <AuditLogDetailDrawer
          log={detailLog}
          onClose={() => setDetailLog(null)}
        />
      )}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────

function TableSkeleton({ rows }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Thực hiện bởi</th>
          <th>Hành động</th>
          <th>Bảng dữ liệu</th>
          <th>Mã bản ghi</th>
          <th>Địa chỉ IP</th>
          <th>Phương thức</th>
          <th>Thời gian xử lý</th>
          <th>Trạng thái</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            {[...Array(10)].map((_, j) => (
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

function AuditTable({ items, onViewLog, timeTick }) {
  // timeTick chỉ để phụ thuộc re-render; formatLocal dùng Date.now() thực tế
  void timeTick;

  if (!items || items.length === 0) {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Thực hiện bởi</th>
            <th>Hành động</th>
            <th>Bảng dữ liệu</th>
            <th>Mã bản ghi</th>
            <th>Địa chỉ IP</th>
            <th>Phương thức</th>
            <th>Thời gian xử lý</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={10} className="table__empty">
              Không có nhật ký nào phù hợp với bộ lọc
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Thực hiện bởi</th>
          <th>Hành động</th>
          <th>Bảng dữ liệu</th>
          <th>
            Mã bản ghi
            <span
              className="th-info"
              title="Mã hiển thị (entity_code) hoặc ID nội bộ (record_id) của bản ghi bị tác động. Ví dụ KH-001 = mã khách hàng #1, USR-005 = mã người dùng #5."
              aria-label="Giải thích"
            >i</span>
          </th>
          <th>Địa chỉ IP</th>
          <th>Phương thức</th>
          <th>Thời gian xử lý</th>
          <th>Trạng thái</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const resp = getResponseBadge(item.response_status);
          const methodCls = getMethodClass(item.request_method);
          const t = formatLocal(item.logged_at);
          const tableVi = viTableName(item.table_name || item.entity_name);
          const codeText = item.entity_code || (item.record_id != null ? `#${item.record_id}` : null);
          return (
            <tr key={item.id}>
              <td>
                <div className="audit-logs__time-cell">
                  <span className="audit-logs__time-main">{t.main}</span>
                  <span className="audit-logs__time-ago">{t.ago}</span>
                  <span className="audit-logs__time-utc" title="Thời điểm UTC gốc từ server">{t.sub}</span>
                </div>
              </td>
              <td>
                <div className="audit-logs__user-cell">
                  <span className="audit-logs__user-name">{item.user_name || 'Hệ thống'}</span>
                  {item.phone_number && (
                    <span className="audit-logs__user-phone">{item.phone_number}</span>
                  )}
                </div>
              </td>
              <td>
                {item.action ? (
                  <span className={`badge ${ACTION_CLASS[item.action] || 'badge--secondary'}`}>
                    {ACTION_LABELS[item.action] || item.action}
                  </span>
                ) : '—'}
              </td>
              <td>
                <span
                  className="audit-logs__entity"
                  title={item.table_name ? `Tên bảng trong DB: ${item.table_name}` : undefined}
                >
                  {tableVi}
                </span>
              </td>
              <td>
                {codeText ? (
                  <span
                    className="audit-logs__code"
                    title={item.entity_code
                      ? `Mã hiển thị: ${item.entity_code}${item.record_id != null ? ` • ID nội bộ: #${item.record_id}` : ''}`
                      : `ID nội bộ: #${item.record_id}`}
                  >
                    {codeText}
                  </span>
                ) : '—'}
              </td>
              <td>
                <span
                  className="audit-logs__ip"
                  title={item.ip_address || 'Không ghi nhận IP'}
                >
                  {item.ip_address || '—'}
                </span>
              </td>
              <td>
                <span className={`audit-logs__method ${methodCls}`}>
                  {item.request_method || '—'}
                </span>
              </td>
              <td>
                <span
                  className="audit-logs__duration"
                  title={item.duration_ms != null ? `${item.duration_ms} ms` : 'Không ghi nhận'}
                >
                  {formatDuration(item.duration_ms)}
                </span>
              </td>
              <td>
                {resp ? (
                  <span className={`badge ${resp.cls}`}>{resp.label}</span>
                ) : '—'}
              </td>
              <td>
                <div className="admin-logs__row-actions">
                  <button
                    type="button"
                    className="admin-logs__action-btn admin-logs__action-btn--primary"
                    onClick={() => onViewLog?.(item)}
                    title="Xem chi tiết nhật ký"
                  >
                    <IconDoc />
                    Chi tiết
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
