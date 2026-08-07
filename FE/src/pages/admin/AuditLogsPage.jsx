import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuditLogs } from '../../hooks/admin/useAuditLogs';
import { auditApi } from '../../services/auditApi';
import { downloadBlob } from '../../utils/downloadBlob';
import { useSharedBranches } from '../../contexts/SharedDataContext';
import { useToast } from '../../components/common/ToastContext';
import { useCrmSearchSync } from '../../utils/crmUrl';
import DateRangeInputs from '../../components/common/DateRangeInputs';
import AdminPagination from './components/AdminPagination';
import {
  humanizeAuditDescription,
  formatAuditTime,
  getAuditActionLabel,
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

function readAuditParamsFromSearch(sp) {
  const out = {};
  const keys = [
    'keyword', 'userName', 'phone', 'action', 'tableName', 'entityName',
    'entityCode', 'ipAddress', 'requestMethod', 'responseStatus',
    'startDate', 'endDate', 'branchId', 'page',
  ];
  keys.forEach((k) => {
    const v = sp.get(k);
    if (v == null || v === '') return;
    if (k === 'page' || k === 'branchId' || k === 'responseStatus') {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
      return;
    }
    out[k] = v;
  });
  return out;
}

function writeAuditParamsToSearch(params) {
  const next = new URLSearchParams();
  const put = (k, v) => {
    if (v === undefined || v === null || v === '') return;
    next.set(k, String(v));
  };
  put('keyword', params.keyword);
  put('userName', params.userName);
  put('phone', params.phone);
  put('action', params.action);
  put('tableName', params.tableName);
  put('entityName', params.entityName);
  put('entityCode', params.entityCode);
  put('ipAddress', params.ipAddress);
  put('requestMethod', params.requestMethod);
  put('responseStatus', params.responseStatus);
  put('startDate', params.startDate);
  put('endDate', params.endDate);
  put('branchId', params.branchId);
  if (params.page > 1) put('page', params.page);
  return next.toString();
}

export default function AuditLogsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const syncSearch = useCrmSearchSync();
  const isInitialMount = useRef(true);
  const urlSeed = useMemo(() => readAuditParamsFromSearch(searchParams), [searchParams]);
  const audit = useAuditLogs(urlSeed);
  const { branches, branchesError } = useSharedBranches();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [showFilters, setShowFilters] = useState(
    Boolean(urlSeed.userName || urlSeed.entityCode || urlSeed.keyword || urlSeed.action)
  );

  const openDetail = useCallback((item) => {
    if (!item?.id) return;
    const qs = writeAuditParamsToSearch(audit.params);
    navigate(`/admin/logs/${item.id}`, {
      state: { fromListSearch: qs ? `?${qs}` : '' },
    });
  }, [navigate, audit.params]);

  // Đồng bộ filter — luôn giữ /crm (useCrmSearchSync).
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const fromUrl = readAuditParamsFromSearch(searchParams);
      if (Object.keys(fromUrl).length > 0) {
        audit.setParams((p) => ({ ...p, ...fromUrl }));
        setShowFilters(true);
      }
      return;
    }
    const qs = writeAuditParamsToSearch(audit.params);
    syncSearch(qs ? new URLSearchParams(qs) : new URLSearchParams(), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    audit.params.page,
    audit.params.keyword,
    audit.params.userName,
    audit.params.phone,
    audit.params.action,
    audit.params.tableName,
    audit.params.entityName,
    audit.params.entityCode,
    audit.params.ipAddress,
    audit.params.requestMethod,
    audit.params.responseStatus,
    audit.params.startDate,
    audit.params.endDate,
    audit.params.branchId,
    syncSearch,
  ]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Làm mới định kỳ — tạm dừng khi đang gõ tìm kiếm / đang load (tránh chồng request nặng)
  useEffect(() => {
    const refreshFn = audit.refresh || audit.refetch;
    if (typeof refreshFn !== 'function') return undefined;
    const searching = Boolean(
      String(audit.params.keyword || '').trim()
      || String(audit.params.userName || '').trim()
      || String(audit.params.phone || '').trim()
    );
    if (searching || audit.loading) return undefined;
    const t = setInterval(() => refreshFn(), 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit.refresh, audit.refetch, audit.loading, audit.params.keyword, audit.params.userName, audit.params.phone]);

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
              <DateRangeInputs
                startDate={audit.params.startDate || ''}
                endDate={audit.params.endDate || ''}
                onChange={({ startDate, endDate }) => {
                  audit.setParams((p) => ({
                    ...p,
                    startDate,
                    endDate,
                    page: 1,
                  }));
                }}
                className="filter-field__date-group"
                inputClassName="filter-field__input filter-field__input--date"
                sepClassName="filter-field__date-sep"
              />
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
              <AuditTable items={audit.data.items} onRowClick={openDetail} now={now} />
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
