import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { adminDevicesApi } from '../../services/adminApi';
import { useLoginSessionsSSE } from '../../hooks/admin/useLoginSessionsSSE';
import { useAuth } from '../../contexts/AppContext';
import { useToast } from '../../components/common/ToastContext';
import { formatDateSafe } from '../../utils/dateUtils';
import './AdminDevicesPage.css';

// ─── Icons ────────────────────────────────────────────────────────────

const IconDevice = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconLogout = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IconAlert = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
  </svg>
);

const IconFilter = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const IconChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ─── Browser icon helper ────────────────────────────────────────────

function getBrowserIcon(browser) {
  const b = (browser || '').toLowerCase();
  if (b.includes('chrome')) return '🌐';
  if (b.includes('firefox')) return '🦊';
  if (b.includes('safari')) return '🧭';
  if (b.includes('edge')) return '🔷';
  if (b.includes('opera')) return '🔴';
  return '💻';
}

function formatDate(dateStr) {
  // Su dung formatDateSafe de dam bao parse duoc moi dinh dang
  // (ISO UTC, Date object) va hien thi VN timezone nhat quan.
  return formatDateSafe(dateStr, {
    timeZone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
  });
}

// ─── Filter Options ────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'true', label: '● Đang hoạt động' },
  { value: 'false', label: '○ Không hoạt động' },
];

const BROWSER_OPTIONS = [
  { value: '', label: 'Tất cả trình duyệt' },
  { value: 'Chrome', label: 'Chrome' },
  { value: 'Firefox', label: 'Firefox' },
  { value: 'Safari', label: 'Safari' },
  { value: 'Edge', label: 'Edge' },
  { value: 'Opera', label: 'Opera' },
];

const OS_OPTIONS = [
  { value: '', label: 'Tất cả hệ điều hành' },
  { value: 'Windows', label: 'Windows' },
  { value: 'Mac', label: 'macOS' },
  { value: 'Linux', label: 'Linux' },
  { value: 'Android', label: 'Android' },
  { value: 'iOS', label: 'iOS' },
];

// ─── Select component ───────────────────────────────────────────────

function SelectFilter({ value, options, onChange, placeholder }) {
  return (
    <div className="admin-devices__select-wrap">
      <select
        className="admin-devices__select"
        value={value}
        onChange={onChange}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <span className="admin-devices__select-arrow"><IconChevronDown /></span>
    </div>
  );
}

// ─── Confirm Modal ─────────────────────────────────────────────────

function ConfirmForceLogoutModal({ device, onClose, onConfirm, loading }) {
  return (
    <div className="confirm-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="confirm-modal">
        <div className="confirm-modal__icon"><IconLogout /></div>
        <h3 className="confirm-modal__title">Đăng xuất thiết bị?</h3>
        <p className="confirm-modal__body">
          Thiết bị <strong>{device?.deviceName}</strong> của <strong>{device?.displayName}</strong>
          {' '}sẽ bị đăng xuất. Người dùng sẽ phải đăng nhập lại trên thiết bị này.
        </p>
        <div className="confirm-modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button className="btn btn--danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Đăng xuất'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────

function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="admin-devices__pagination">
      <span className="pagination-info">
        Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} trong {total} thiết bị
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >‹</button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} style={{ color: '#94a3b8', padding: '0 4px' }}>…</span>
          ) : (
            <button
              key={p}
              className={`pagination-btn ${p === page ? 'pagination-btn--active' : ''}`}
              onClick={() => onPageChange(p)}
            >{p}</button>
          )
        )}
        <button
          className="pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >›</button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function AdminDevicesPage({
  embedded = false,
  seedSearch = '',
  seedUserId = null,
  seedIsCurrent = '',
  seedKey = 0,
} = {}) {
  const toast = useToast();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  // Bug cu: searchTimer la useState -> clearTimeout(searchTimer) co the clear
  // timeout cu (state chua update) khi user go lien tuc -> race condition.
  // Fix: dung useRef de luu timer ID (ref dong bo, khong can render moi).
  const searchTimerRef = useRef(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState(null);
  const [browserFilter, setBrowserFilter] = useState('');
  const [osFilter, setOsFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [logoutTarget, setLogoutTarget] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const PAGE_SIZE = 20;

  const loadData = useCallback(async (pageNum = 1, extraParams = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: pageNum,
        pageSize: PAGE_SIZE,
        search: search || undefined,
      };
      if (userIdFilter) params.userId = userIdFilter;
      if (statusFilter) params.isCurrent = statusFilter;
      if (browserFilter) params.browser = browserFilter;
      if (osFilter) params.os = osFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      // Seed từ cảnh bảo: extraParams thắng state (tránh race setState)
      Object.assign(params, extraParams);
      // Chuẩn hóa: chuỗi rỗng / null = bỏ filter
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] === null || params[k] === undefined) {
          delete params[k];
        }
      });

      const data = await adminDevicesApi.list(params);
      setDevices(data?.items || []);
      setTotal(data?.total || 0);
      setPage(pageNum);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách thiết bị');
    } finally {
      setLoading(false);
    }
  }, [search, userIdFilter, statusFilter, browserFilter, osFilter, dateFrom, dateTo]);

  useEffect(() => { loadData(1); }, []);

  // Seed từ panel cảnh báo ("Xem thiết bị")
  useEffect(() => {
    if (!seedKey) return;
    const nextSearch = seedSearch || '';
    const nextUserId = seedUserId || null;
    const nextStatus = seedIsCurrent ?? '';
    setSearch(nextSearch);
    setUserIdFilter(nextUserId);
    setStatusFilter(nextStatus);
    setBrowserFilter('');
    setOsFilter('');
    setDateFrom('');
    setDateTo('');
    loadData(1, {
      search: nextSearch || undefined,
      userId: nextUserId || undefined,
      isCurrent: nextStatus || undefined,
      browser: undefined,
      os: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  // Reload khi đổi filter (status/browser/os/date) — không phụ thuộc blur
  useEffect(() => {
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, browserFilter, osFilter, dateFrom, dateTo, userIdFilter]);

  // SSE listener - chi cap nhat row bi anh huong (login/logout/force),
  // tranh loadData() gay giat man hinh khi user dang cuon/xem.
  const handleSSEEvent = useCallback((eventData) => {
    if (!eventData || !['login', 'logout', 'force'].includes(eventData.type)) return;

    const changedDeviceId = Number(
      eventData.deviceId ?? eventData.payload?.deviceId ?? eventData.device?.id
    );
    const userIdChanged = Number(
      eventData.userId ?? eventData.payload?.userId ?? eventData.user?.id
    );

    if (eventData.type === 'force' || eventData.type === 'logout') {
      setDevices((prev) =>
        prev.map((d) => {
          if (changedDeviceId && d.id === changedDeviceId) return { ...d, isCurrent: false };
          if (!changedDeviceId && userIdChanged && d.userId === userIdChanged) {
            return { ...d, isCurrent: false };
          }
          return d;
        })
      );
      // force/logout không có deviceId → refetch để đồng bộ với lịch sử đăng nhập
      if (!changedDeviceId) loadData(page);
      return;
    }

    if (eventData.type === 'login' && (changedDeviceId || userIdChanged)) {
      setDevices((prev) => {
        let next = prev;
        if (userIdChanged) {
          next = next.map((d) =>
            d.userId === userIdChanged && d.id !== changedDeviceId
              ? { ...d, isCurrent: false }
              : d
          );
        }
        if (changedDeviceId) {
          next = next.map((d) => (d.id === changedDeviceId ? { ...d, isCurrent: true } : d));
        }
        return next;
      });
      if (!changedDeviceId) loadData(page);
      return;
    }

    loadData(page);
  }, [loadData, page]);

  const { token } = useAuth();
  // Truyen token de SSE auth (BE validate Bearer hoac ?token= query)
  useLoginSessionsSSE(handleSSEEvent, true, token);

  // Sort client-side de dam bao is_current len tren, moi nhat truoc.
  // BE da sort (trong DeviceRepository), nhung useMemo nay giup FE on dinh
  // ngay ca khi SSE patch row don le.
  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      // is_current=true len tren
      const ca = a.isCurrent ? 0 : 1;
      const cb = b.isCurrent ? 0 : 1;
      if (ca !== cb) return ca - cb;

      // Moi nhat truoc: uu tien lastActivityAt, fallback lastLoginAt
      const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      if (ta !== tb) return tb - ta;

      const la = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
      const lb = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      return lb - la;
    });
  }, [devices]);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;
      loadData(1);
    }, 400);
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, []);

  function handleFilterChange() {
    loadData(1);
  }

  function handleClearFilters() {
    setSearch('');
    setUserIdFilter(null);
    setStatusFilter('');
    setBrowserFilter('');
    setOsFilter('');
    setDateFrom('');
    setDateTo('');
    loadData(1, {
      search: undefined,
      userId: undefined,
      isCurrent: undefined,
      browser: undefined,
      os: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  }

  function handlePageChange(newPage) {
    loadData(newPage);
  }

  async function handleForceLogout() {
    if (!logoutTarget) return;
    const targetId = logoutTarget.id;
    const targetName = logoutTarget.deviceName;
    setLogoutLoading(true);
    try {
      await adminDevicesApi.forceLogout(targetId);
      toast.warning(`Đã đăng xuất thiết bị "${targetName}"`);
      setLogoutTarget(null);
      
      // Smooth update - chi cap nhat device bi revoke, khong load lai toan bo trang
      // Đanh dau device thanh inactive (isCurrent = false)
      setDevices(prev => prev.map(d => 
        d.id === targetId 
          ? { ...d, isCurrent: false } 
          : d
      ));
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đăng xuất thiết bị');
    } finally {
      setLogoutLoading(false);
    }
  }

  const hasActiveFilters = statusFilter || browserFilter || osFilter || dateFrom || dateTo || search || userIdFilter;

  return (
    <div className={`admin-devices${embedded ? ' admin-devices--embedded' : ''}`}>
      {!embedded && (
        <div className="admin-devices__header">
          <div className="admin-devices__title-block">
            <div className="admin-devices__title-icon">
              <IconDevice />
            </div>
            <div className="admin-devices__title-group">
              <h1>Thiết bị đăng nhập</h1>
              <p className="admin-devices__subtitle">Quản lý thiết bị đang đăng nhập &amp; Force Logout</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: tìm kiếm + lọc + làm mới trên 1 khối */}
      <div className="admin-devices__toolbar">
        <div className="admin-devices__toolbar-top">
          <div className="admin-devices__search-wrap">
            <span className="admin-devices__search-icon" aria-hidden="true">
              <IconSearch />
            </span>
            <input
              type="text"
              className="admin-devices__search"
              placeholder="Tìm theo tên, SĐT, IP, trình duyệt..."
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm admin-devices__refresh"
            onClick={() => loadData(page)}
            title="Làm mới"
          >
            <IconRefresh /> Làm mới
          </button>
        </div>

        <div className="admin-devices__toolbar-filters">
          <div className="admin-devices__filter-group">
            <IconFilter />
            <SelectFilter
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <SelectFilter
            value={browserFilter}
            options={BROWSER_OPTIONS}
            onChange={(e) => setBrowserFilter(e.target.value)}
          />
          <SelectFilter
            value={osFilter}
            options={OS_OPTIONS}
            onChange={(e) => setOsFilter(e.target.value)}
          />
          <div className="admin-devices__filter-group admin-devices__filter-group--date">
            <input
              type="date"
              className="admin-devices__date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Từ ngày"
            />
            <span className="admin-devices__date-sep">—</span>
            <input
              type="date"
              className="admin-devices__date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Đến ngày"
            />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn--ghost btn--sm admin-devices__clear-filters"
              onClick={handleClearFilters}
            >
              ✕ Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && devices.length === 0 && (
        <div className="admin-devices__loading">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span>Đang tải danh sách thiết bị...</span>
        </div>
      )}

      {error && !loading && (
        <div className="admin-devices__error">
          <IconAlert />
          <span>{error}</span>
          <button className="btn btn--secondary btn--sm" onClick={() => loadData(page)}>Thử lại</button>
        </div>
      )}

      {!loading && !error && devices.length === 0 && (
        <div className="admin-devices__empty">
          <IconDevice />
          <p>{search || hasActiveFilters ? 'Không tìm thấy thiết bị nào' : 'Chưa có thiết bị nào được ghi nhận'}</p>
        </div>
      )}

      {!loading && !error && devices.length > 0 && (
        <div className="admin-devices__table-wrap">
          <table className="admin-devices__table">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Thiết bị</th>
                <th>Người dùng</th>
                <th>Địa chỉ IP</th>
                <th>Đăng nhập gần nhất</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sortedDevices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <div className="admin-devices__cell-stack">
                      <span className="admin-devices__cell-title">
                        {getBrowserIcon(device.browser)} {device.deviceName || 'Unknown Device'}
                      </span>
                      <span className="admin-devices__cell-sub">{device.browser} · {device.os}</span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-devices__cell-stack">
                      <span className="admin-devices__cell-title">{device.displayName || device.userName || '—'}</span>
                      {device.branchName && <span className="admin-devices__cell-sub">{device.branchName}</span>}
                    </div>
                  </td>
                  <td>
                    <span className="admin-devices__mono">{device.ipAddress || '—'}</span>
                  </td>
                  <td>
                    <span className="admin-devices__mono">{formatDate(device.lastLoginAt)}</span>
                  </td>
                  <td>
                    <span className={`admin-devices__badge ${device.isCurrent ? 'admin-devices__badge--on' : 'admin-devices__badge--off'}`}>
                      {device.isCurrent ? '● Hiện tại' : '○ Không hoạt động'}
                    </span>
                  </td>
                  <td>
                    {!device.isCurrent ? (
                      <span className="btn btn--secondary btn--sm btn--disabled">
                        Đã đăng xuất
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => setLogoutTarget(device)}
                        title="Đăng xuất khỏi thiết bị này"
                      >
                        <IconLogout /> Đăng xuất
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Confirm modal */}
      {logoutTarget && (
        <ConfirmForceLogoutModal
          device={logoutTarget}
          onClose={() => setLogoutTarget(null)}
          onConfirm={handleForceLogout}
          loading={logoutLoading}
        />
      )}
    </div>
  );
}
