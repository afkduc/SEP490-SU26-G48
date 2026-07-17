import { useEffect, useState, useCallback } from 'react';
import { adminDevicesApi } from '../../services/adminApi';
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
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchTimer, setSearchTimer] = useState(null);

  const [logoutTarget, setLogoutTarget] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const PAGE_SIZE = 20;

  const loadData = useCallback(async (pageNum = 1, searchQuery = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await adminDevicesApi.list({
        page: pageNum,
        pageSize: PAGE_SIZE,
        search: searchQuery || undefined,
      });
      setDevices(data?.items || []);
      setTotal(data?.total || 0);
      setPage(pageNum);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách thiết bị');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(1, ''); }, [loadData]);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      loadData(1, val);
    }, 400);
    setSearchTimer(timer);
  }

  function handlePageChange(newPage) {
    loadData(newPage, search);
  }

  async function handleForceLogout() {
    if (!logoutTarget) return;
    setLogoutLoading(true);
    try {
      await adminDevicesApi.forceLogout(logoutTarget.id);
      setLogoutTarget(null);
      loadData(page, search);
    } catch (err) {
      alert(err.message || 'Lỗi khi đăng xuất thiết bị');
    } finally {
      setLogoutLoading(false);
    }
  }

  return (
    <div className="admin-devices">
      {/* Header */}
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
        <div className="admin-devices__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => loadData(page, search)} title="Làm mới">
            <IconRefresh /> Làm mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-devices__filters">
        <div className="search-input-wrapper">
          <IconSearch />
          <input
            type="text"
            className="search-input"
            placeholder="Tìm theo tên thiết bị, IP, người dùng..."
            value={search}
            onChange={handleSearchChange}
          />
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
          <button className="btn btn--secondary btn--sm" onClick={() => loadData(page, search)}>Thử lại</button>
        </div>
      )}

      {!loading && !error && devices.length === 0 && (
        <div className="admin-devices__empty">
          <IconDevice />
          <p>{search ? 'Không tìm thấy thiết bị nào' : 'Chưa có thiết bị nào được ghi nhận'}</p>
        </div>
      )}

      {!loading && !error && devices.length > 0 && (
        <div className="devices-table-wrapper">
          <table className="devices-table">
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
              {devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <div className="device-info">
                      <span className="device-name">
                        {getBrowserIcon(device.browser)} {device.deviceName || 'Unknown Device'}
                      </span>
                      <span className="device-meta">{device.browser} · {device.os}</span>
                    </div>
                  </td>
                  <td>
                    <div className="user-info">
                      <span className="user-name-cell">{device.displayName || device.userName || '—'}</span>
                      {device.branchName && <span className="user-branch-cell">{device.branchName}</span>}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{device.ipAddress || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{formatDate(device.lastLoginAt)}</td>
                  <td>
                    <span className={`current-badge ${device.isCurrent ? 'current-badge--yes' : 'current-badge--no'}`}>
                      {device.isCurrent ? '● Hiện tại' : '○ Không hoạt động'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => setLogoutTarget(device)}
                      title="Đăng xuất khỏi thiết bị này"
                    >
                      <IconLogout /> Đăng xuất
                    </button>
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
