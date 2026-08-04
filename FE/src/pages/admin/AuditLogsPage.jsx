import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuditLogs } from '../../hooks/admin/useAuditLogs';
import { auditApi } from '../../services/auditApi';
import { downloadBlob } from '../../utils/downloadBlob';
import { useSharedBranches } from '../../contexts/SharedDataContext';
import { useToast } from '../../components/common/ToastContext';
import AdminPagination from './components/AdminPagination';
import {
  getAuditFieldLabel,
  humanizeAuditDescription,
  formatAuditFieldValue,
  summarizeAuditNewValue,
  summarizeAuditObjectRows,
  formatAuditTime,
  parseAuditJson,
  getAuditActionLabel,
  getHttpMethodLabel,
  getResponseStatusLabel,
  getResponseStatusTone,
  getResponseStatusDetail,
  formatEntityCodeDisplay,
  formatDurationMs,
  humanizeRequestUrl,
  isSameAuditPayload,
  isAuditSignatureValue,
  AUDIT_TABLE_LABELS,
} from '../../utils/auditDisplay';
import './AuditLogsPage.css';

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'CREATE', label: 'Tạo mới', color: 'success' },
  { value: 'UPDATE', label: 'Cập nhật', color: 'info' },
  { value: 'DELETE', label: 'Xóa', color: 'danger' },
  { value: 'READ', label: 'Xem dữ liệu', color: 'slate' },
  { value: 'LOGIN', label: 'Đăng nhập', color: 'purple' },
  { value: 'FAILED_LOGIN', label: 'Đăng nhập thất bại', color: 'danger' },
  { value: 'LOGOUT', label: 'Đăng xuất', color: 'gray' },
  { value: 'FORCE_LOGO', label: 'Buộc đăng xuất', color: 'orange' },
  { value: 'CHANGE_PASSWORD', label: 'Đổi mật khẩu', color: 'teal' },
  { value: 'RESET_PASSWORD', label: 'Đặt lại mật khẩu', color: 'cyan' },
  { value: 'ASSIGN_ROLE', label: 'Gán vai trò', color: 'indigo' },
  { value: 'REMOVE_ROLE', label: 'Thu hồi vai trò', color: 'rose' },
  { value: 'EXPORT', label: 'Xuất dữ liệu', color: 'green' },
  { value: 'IMPORT', label: 'Nhập dữ liệu', color: 'amber' },
  { value: 'GRANT_SCREEN', label: 'Cấp quyền màn hình', color: 'success' },
  { value: 'REVOKE_SCREEN', label: 'Thu hồi quyền màn hình', color: 'danger' },
  { value: 'SAVE_SCREEN_MATRIX', label: 'Lưu ma trận quyền', color: 'indigo' },
  { value: 'APPROVE_PERMISSION_REQUEST', label: 'Duyệt yêu cầu quyền', color: 'success' },
  { value: 'REJECT_PERMISSION_REQUEST', label: 'Từ chối yêu cầu quyền', color: 'danger' },
];

const ACTION_CLASS = {
  CREATE: 'badge--success',
  UPDATE: 'badge--info',
  DELETE: 'badge--danger',
  READ: 'badge--slate',
  LOGIN: 'badge--purple',
  FAILED_LOGIN: 'badge--danger',
  LOGOUT: 'badge--secondary',
  FORCE_LOGOUT: 'badge--orange',
  FORCE_LOGO: 'badge--orange',
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
  APPROVE_LOGIN_CHALLENGE: 'badge--success',
  REJECT_LOGIN_CHALLENGE: 'badge--danger',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '2xx', label: 'Thành công' },
  { value: '4xx', label: 'Lỗi phía người dùng' },
  { value: '5xx', label: 'Lỗi máy chủ' },
];

/** Map table_name → tiếng Việt (dùng chung từ auditDisplay) */
const TABLE_NAME_VI = AUDIT_TABLE_LABELS;

function formatLocal(value) {
  return formatAuditTime(value);
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
  const [searchParams] = useSearchParams();
  const initialUserName = searchParams.get('userName') || '';
  const audit = useAuditLogs(initialUserName ? { userName: initialUserName } : {});
  const { branches, branchesError } = useSharedBranches();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [showFilters, setShowFilters] = useState(Boolean(initialUserName));
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const fromUrl = searchParams.get('userName') || '';
    if (!fromUrl) return;
    audit.setParams((p) => ({
      ...p,
      userName: fromUrl,
      page: 1,
    }));
    setShowFilters(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Làm mới danh sách định kỳ để thời gian / log mới gần realtime
  useEffect(() => {
    const refreshFn = audit.refresh || audit.refetch;
    if (typeof refreshFn !== 'function') return undefined;
    const t = setInterval(() => refreshFn(), 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ gắn theo hàm refresh ổn định
  }, [audit.refresh, audit.refetch]);

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
      excludeAuthEvents: true,
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
              placeholder="Tìm nhanh (tên, SĐT, mã, mô tả...)"
              value={audit.params.keyword || ''}
              onChange={(e) => audit.updateParam('keyword', e.target.value)}
            />
          </div>
          <label className="admin-logs__auth-toggle" title="Mặc định ẩn đăng nhập / thất bại (xem ở Lịch sử đăng nhập)">
            <input
              type="checkbox"
              checked={audit.params.excludeAuthEvents !== false && audit.params.excludeAuthEvents !== 'false'}
              onChange={(e) => {
                audit.setParams((prev) => ({
                  ...prev,
                  excludeAuthEvents: e.target.checked,
                  page: 1,
                }));
              }}
            />
            <span>Ẩn đăng nhập / thất bại</span>
          </label>
        </div>

        {showFilters && (
          <div className="admin-logs__filter-body">
            <div className="filter-field">
              <label className="filter-field__label">Người dùng</label>
              <input
                className="filter-field__input"
                type="text"
                placeholder="Tên hoặc SĐT (có/không dấu)..."
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
              <label className="filter-field__label">Mã phiếu</label>
              <input
                className="filter-field__input"
                type="text"
                placeholder="VD: RO-2026-080, LSC-..., YCDV-..."
                value={audit.params.entityCode || ''}
                onChange={(e) => audit.updateParam('entityCode', e.target.value)}
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
              <AuditTable items={audit.data.items} onRowClick={setSelectedLog} now={now} />
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

function AuditTable({ items, onRowClick, now }) {
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
          void now; // tick để cập nhật "vừa xong" realtime
          const t = formatLocal(item.logged_at);
          const userName = item.user_name || 'Hệ thống';
          const initials = userName.split(' ').filter(Boolean).slice(-2)
            .map((p) => p[0]).join('').toUpperCase() || '?';
          const description = humanizeAuditDescription(
            item.description,
            item.action,
            item.new_value,
            { entityCode: item.entity_code, entityName: item.entity_name }
          );
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
                  <span className={`badge ${ACTION_CLASS[item.action] || 'badge--secondary'}`}>
                    {getAuditActionLabel(item.action)}
                  </span>
                ) : '—'}
              </td>
              <td>
                <span className="audit-logs__description" title={description}>
                  {description || '—'}
                </span>
              </td>
              <td className="audit-logs__cell--branch">
                {item.branch_name
                  || item.branchName
                  || ((item.user_name || item.userName || '').toLowerCase() === 'system'
                    ? 'Hệ thống'
                    : (item.branch_id != null || item.branchId != null
                      ? `#${item.branch_id ?? item.branchId}`
                      : '—'))}
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

function formatMoneyCell(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('vi-VN')} ₫`;
}

function SettlementItemsTable({ items }) {
  const list = Array.isArray(items)
    ? items
    : (parseAuditJson(items) || []);
  if (!list.length) return <span className="audit-detail__json-empty">—</span>;

  return (
    <div className="audit-detail__items-wrap">
      <table className="audit-detail__items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Tên hạng mục</th>
            <th>Mã</th>
            <th>SL</th>
            <th>Đơn vị</th>
            <th>Đơn giá</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item, index) => {
            const name = item?.description || item?.name || `Hạng mục ${index + 1}`;
            const isParent = item?.isGroupParent;
            return (
              <tr key={`${item?.code || 'i'}-${index}`} className={isParent ? 'is-group' : undefined}>
                <td>{index + 1}</td>
                <td>
                  <span className="audit-detail__item-name">{name}</span>
                  {item?.isFree ? <span className="audit-detail__item-tag">Miễn phí</span> : null}
                </td>
                <td>{item?.code || '—'}</td>
                <td>{item?.qty != null ? item.qty : '—'}</td>
                <td>{item?.unit || '—'}</td>
                <td>{formatMoneyCell(item?.unitPrice)}</td>
                <td>{formatMoneyCell(item?.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AuditSignatureBlock({ raw }) {
  if (!isAuditSignatureValue(raw)) return <span>Đã ký</span>;
  const src = String(raw).startsWith('data:image/')
    ? String(raw)
    : `data:image/png;base64,${raw}`;
  return (
    <div className="audit-detail__signature">
      <img src={src} alt="Chữ ký khách hàng" />
      <span>Đã ký</span>
    </div>
  );
}

function AuditFieldCell({ row, className = 'diff-new' }) {
  const kind = row.kind || 'text';
  if (kind === 'items' || kind === 'signature') {
    return <td className={className}>{row.value}</td>;
  }
  return (
    <td className={`${className}${kind === 'money' ? ' diff-money' : ''}`}>
      {row.value}
    </td>
  );
}

/** Bảng key-value + khối hạng mục / chữ ký full chiều ngang */
function AuditRowsView({ rows, summary }) {
  if (!rows?.length) return null;
  const simpleRows = rows.filter((r) => r.kind !== 'items' && r.kind !== 'signature');
  const itemsRow = rows.find((r) => r.kind === 'items');
  const sigRow = rows.find((r) => r.kind === 'signature');

  return (
    <div className="audit-detail__diff-table">
      {summary ? (
        <p className="audit-detail__diff-summary">{summary}</p>
      ) : null}

      {simpleRows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Thông tin</th>
              <th>Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {simpleRows.map((row) => (
              <tr key={row.key || row.label}>
                <td className="diff-label">{row.label}</td>
                <AuditFieldCell row={row} />
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {itemsRow && (
        <div className="audit-detail__block">
          <div className="audit-detail__block-title">{itemsRow.label}</div>
          <SettlementItemsTable items={itemsRow.raw} />
        </div>
      )}

      {sigRow && (
        <div className="audit-detail__block">
          <div className="audit-detail__block-title">{sigRow.label}</div>
          <AuditSignatureBlock raw={sigRow.raw} />
        </div>
      )}
    </div>
  );
}

/** Bảng dữ liệu tiếng Việt; nếu không phẳng được thì hiện JSON gốc */
function HumanizedDataView({ data }) {
  const rows = summarizeAuditObjectRows(data);
  if (!rows?.length) return <JsonView data={data} />;
  return <AuditRowsView rows={rows} />;
}

/**
 * Format old/new value thành dạng human-readable
 */
function DiffView({ oldValue, newValue, action }) {
  const oldObj = parseAuditJson(oldValue);
  const newObj = parseAuditJson(newValue);
  const summary = summarizeAuditNewValue(newValue, action);

  if (!oldObj && !newObj) return <span className="audit-detail__json-empty">—</span>;

  // Ưu tiên bảng tóm tắt dễ đọc cho giá trị mới
  if (summary?.rows?.length) {
    return (
      <div>
        <AuditRowsView rows={summary.rows} summary={summary.summary} />
        {oldObj && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 13 }}>Xem giá trị cũ</summary>
            <HumanizedDataView data={oldValue} />
          </details>
        )}
      </div>
    );
  }

  const isSimpleObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.keys(obj).length <= 10;

  if (isSimpleObject(oldObj) && isSimpleObject(newObj)) {
    const allKeys = [...new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})])];
    const changes = allKeys.filter((k) => oldObj?.[k] !== newObj?.[k]);

    if (changes.length > 0) {
      return (
        <div className="audit-detail__diff-table">
          <table>
            <thead>
              <tr>
                <th>Thông tin</th>
                <th>Giá trị cũ</th>
                <th>Giá trị mới</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((key) => {
                const label = getAuditFieldLabel(key);
                return (
                  <tr key={key}>
                    <td className="diff-label">{label}</td>
                    <td className="diff-old">{formatAuditFieldValue(key, oldObj?.[key])}</td>
                    <td className="diff-new">{formatAuditFieldValue(key, newObj?.[key])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (Object.keys(newObj || {}).length > 0) {
      return (
        <div className="audit-detail__diff-table">
          <table>
            <thead>
              <tr>
                <th>Thông tin</th>
                <th>Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(newObj).map(([key, value]) => (
                <tr key={key}>
                  <td className="diff-label">{getAuditFieldLabel(key)}</td>
                  <td>{formatAuditFieldValue(key, value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  return (
    <div className="audit-detail__diff-raw">
      {oldObj && (
        <div className="audit-detail__diff-col">
          <label>Giá trị cũ</label>
          <HumanizedDataView data={oldValue} />
        </div>
      )}
      {newObj && (
        <div className="audit-detail__diff-col">
          <label>Giá trị mới</label>
          <HumanizedDataView data={newValue} />
        </div>
      )}
    </div>
  );
}

function isEmptyRequestBody(body) {
  if (body == null || body === '') return true;
  if (typeof body === 'string') {
    const t = body.trim();
    if (!t || t === '{}' || t === 'null' || t === '[]') return true;
    try {
      const parsed = JSON.parse(t);
      if (parsed == null) return true;
      if (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0) return true;
      if (Array.isArray(parsed) && parsed.length === 0) return true;
    } catch {
      return false;
    }
    return false;
  }
  if (typeof body === 'object') {
    if (Array.isArray(body)) return body.length === 0;
    return Object.keys(body).length === 0;
  }
  return false;
}

function AuditLogDetailModal({ log, onClose }) {
  if (!log) return null;
  const t = formatLocal(log.logged_at);
  const userName = log.user_name || 'Hệ thống';
  const actionLabel = getAuditActionLabel(log.action);
  const objectLabel = TABLE_NAME_VI[log.table_name] || log.entity_name || 'hệ thống';
  const entityCodeInfo = formatEntityCodeDisplay(log.entity_code, log.table_name, log.entity_name);
  const descMeta = { entityCode: log.entity_code, entityName: log.entity_name || objectLabel };
  const summary = humanizeAuditDescription(log.description, log.action, log.new_value, descMeta)
    || `${userName} đã ${String(actionLabel).toLowerCase()} trên ${String(objectLabel).toLowerCase()}.`;
  const methodLabel = getHttpMethodLabel(log.request_method);
  const statusLabel = getResponseStatusLabel(log.response_status);
  const statusDetail = getResponseStatusDetail(log.response_status);
  const statusTone = getResponseStatusTone(log.response_status);
  const urlLabel = humanizeRequestUrl(log.request_url);
  // Ẩn "Dữ liệu gửi kèm" nếu trùng hoàn toàn với chi tiết thay đổi (new_value)
  const showRequestBody = !isEmptyRequestBody(log.request_body)
    && !isSameAuditPayload(log.request_body, log.new_value);
  const statusBadgeClass =
    statusTone === 'success' ? 'badge--success'
      : statusTone === 'danger' ? 'badge--danger'
        : 'badge--secondary';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content audit-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Chi tiết nhật ký</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="audit-detail__summary">
            {summary}
          </div>

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
              </div>
            </div>
          </div>

          {entityCodeInfo && (
            <div className="audit-detail__row">
              <div className="audit-detail__field audit-detail__field--full">
                <label>{entityCodeInfo.label}</label>
                <div className="audit-detail__value" title={entityCodeInfo.hint}>
                  <strong className="audit-detail__code">{entityCodeInfo.value}</strong>
                  <span className="audit-detail__code-hint">{entityCodeInfo.hint}</span>
                </div>
              </div>
            </div>
          )}

          <div className="audit-detail__row audit-detail__row--secondary">
            <div className="audit-detail__field">
              <label>Kết quả</label>
              <span className={`badge ${statusBadgeClass}`} title={statusDetail}>
                {statusLabel}
              </span>
            </div>
            {log.request_method && (
              <div className="audit-detail__field">
                <label>Loại thao tác</label>
                <span>{methodLabel}</span>
              </div>
            )}
            {urlLabel && (
              <div className="audit-detail__field audit-detail__field--full">
                <label>Nội dung thao tác</label>
                <span>{urlLabel}</span>
              </div>
            )}
            {log.duration_ms != null && (
              <div className="audit-detail__field">
                <label>Thời gian xử lý</label>
                <span>{formatDurationMs(log.duration_ms)}</span>
              </div>
            )}
            {(log.branch_name || log.branchName) && (
              <div className="audit-detail__field">
                <label>Chi nhánh</label>
                <span>{log.branch_name || log.branchName}</span>
              </div>
            )}
            {log.ip_address && (
              <div className="audit-detail__field">
                <label>Địa chỉ IP</label>
                <span>{log.ip_address}</span>
              </div>
            )}
          </div>

          {log.description && (
            <div className="audit-detail__section">
              <label>Mô tả</label>
              <p className="audit-detail__description">
                {humanizeAuditDescription(log.description, log.action, log.new_value, descMeta)}
              </p>
            </div>
          )}

          {(log.old_value || log.new_value) && (
            <div className="audit-detail__diff">
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#475569' }}>
                Chi tiết thay đổi
              </label>
              <DiffView oldValue={log.old_value} newValue={log.new_value} action={log.action} />
            </div>
          )}

          {showRequestBody && (
            <div className="audit-detail__section">
              <label>Dữ liệu gửi kèm</label>
              <HumanizedDataView data={log.request_body} />
            </div>
          )}

          <div className="audit-detail__timestamp">
            <span title={t.sub}>{t.main}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
