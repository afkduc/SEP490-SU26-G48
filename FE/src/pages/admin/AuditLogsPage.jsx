import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuditLogs } from '../../hooks/admin/useAuditLogs';
import { useLoginSessions } from '../../hooks/admin/useLoginSessions';
import { adminApi } from '../../services';
import './AuditLogsPage.css';

// ID cua 2 section dung cho scroll navigation va IntersectionObserver
const SECTION_AUDIT_ID = 'audit-section';
const SECTION_LOGIN_ID = 'login-section';

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
];

const ACTION_LABELS = { CREATE: 'Tạo mới', UPDATE: 'Cập nhật', DELETE: 'Xóa' };
const ACTION_CLASS = { CREATE: 'badge--success', UPDATE: 'badge--info', DELETE: 'badge--danger' };

const LOGIN_ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'LOGIN', label: 'Đăng nhập' },
  { value: 'LOGIN_FAILED', label: 'Đăng nhập thất bại' },
];

const LOGIN_ACTION_CLASS = { LOGIN: 'badge--success', LOGIN_FAILED: 'badge--danger' };
const LOGIN_ACTION_LABEL = { LOGIN: 'Đăng nhập', LOGIN_FAILED: 'Thất bại' };

const SESSION_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'ended', label: 'Đã đăng xuất' },
  { value: 'failed', label: 'Thất bại' },
];

const SESSION_STATUS_CLASS = { active: 'badge--success', ended: 'badge--secondary', failed: 'badge--danger' };
const SESSION_STATUS_LABEL = { active: 'Đang hoạt động', ended: 'Đã đăng xuất', failed: 'Thất bại' };

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getResponseBadge(status) {
  if (!status) return null;
  if (status >= 200 && status < 300) return { cls: 'badge--success', label: status };
  if (status >= 400 && status < 500) return { cls: 'badge--warning', label: status };
  if (status >= 500) return { cls: 'badge--danger', label: status };
  return { cls: 'badge--secondary', label: status };
}

function Pagination({ currentPage, totalPages, total, onChange, loading }) {
  if (total === 0) return null;

  function handlePageChange(page) {
    if (page < 1 || page > totalPages || loading) return;
    onChange(page);
  }

  return (
    <div className="pagination">
      <span className="pagination__info">
        Tổng <strong>{total}</strong> bản ghi
        &nbsp;— Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
      </span>
      <div className="pagination__controls">
        <button
          className="pagination__nav-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Trước
        </button>

        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let pageNum;
          if (totalPages <= 7) pageNum = i + 1;
          else if (currentPage <= 4) pageNum = i + 1;
          else if (currentPage >= totalPages - 3) pageNum = totalPages - 6 + i;
          else pageNum = currentPage - 3 + i;

          return (
            <button
              key={pageNum}
              className={`pagination__page-btn ${currentPage === pageNum ? 'active' : ''}`}
              onClick={() => handlePageChange(pageNum)}
              disabled={loading}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          className="pagination__nav-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
        >
          Sau
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function LogsTabSwitcher({ activeTab, onTabClick }) {
  return (
    <div className="admin-logs__tab-bar" role="tablist" aria-label="Loai nhat ky">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'audit'}
        className={
          'admin-logs__tab-btn' + (activeTab === 'audit' ? ' admin-logs__tab-btn--active' : '')
        }
        onClick={() => onTabClick('audit', SECTION_AUDIT_ID)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        Nhật ký hoạt động
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'login'}
        className={
          'admin-logs__tab-btn' + (activeTab === 'login' ? ' admin-logs__tab-btn--active' : '')
        }
        onClick={() => onTabClick('login', SECTION_LOGIN_ID)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Lịch sử đăng nhập
      </button>
    </div>
  );
}

export default function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Doc tab tu query string de ho tro deep linking (/admin/logs?tab=login).
  const initialTab = searchParams.get('tab') === 'login' ? 'login' : 'audit';
  const [activeTab, setActiveTab] = useState(initialTab);

  const audit = useAuditLogs();
  const sessions = useLoginSessions();

  const auditSectionRef = useRef(null);
  const loginSectionRef = useRef(null);
  // Khoa observer trong khi dang smooth-scroll do click tab,
  // tranh observer "nhay" tab trong qua trinh scroll.
  const programmaticScrollRef = useRef(false);

  const [branches, setBranches] = useState([]);
  const [branchesError, setBranchesError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.adminBranchesApi.list();
        if (!cancelled) setBranches(res?.items || []);
      } catch (err) {
        if (!cancelled) setBranchesError(err.message || 'Không tải được chi nhánh');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // IntersectionObserver: tu dong cap nhat active tab dua tren section
  // dang hien thi tren man hinh khi nguoi dung cuon thu cong.
  useEffect(() => {
    if (!auditSectionRef.current || !loginSectionRef.current) return undefined;

    const visibility = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibility.set(entry.target.id, entry.intersectionRatio);
        });
        if (programmaticScrollRef.current) return;

        const auditRatio = visibility.get(SECTION_AUDIT_ID) || 0;
        const loginRatio = visibility.get(SECTION_LOGIN_ID) || 0;
        const maxRatio = Math.max(auditRatio, loginRatio);
        if (maxRatio < 0.15) return;

        if (loginRatio > auditRatio) {
          setActiveTab('login');
        } else {
          setActiveTab('audit');
        }
      },
      {
        threshold: [0, 0.15, 0.3, 0.5, 0.75, 1],
        rootMargin: '-80px 0px -40% 0px',
      }
    );

    observer.observe(auditSectionRef.current);
    observer.observe(loginSectionRef.current);

    return () => observer.disconnect();
  }, []);

  // Sau khi component mount, neu URL co ?tab=login thi smooth-scroll den section login.
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') === 'login' ? 'login' : 'audit';
    if (tabFromUrl !== 'login') return undefined;
    // Doi 1 tick de DOM/scroll-margin san sang
    const t = window.setTimeout(() => {
      const el = document.getElementById(SECTION_LOGIN_ID);
      if (el) {
        programmaticScrollRef.current = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => {
          programmaticScrollRef.current = false;
        }, 800);
      }
    }, 150);
    return () => window.clearTimeout(t);
  }, [searchParams]);

  // Xu ly click tab: cap nhat query string, state va smooth-scroll.
  function handleTabClick(tabId, sectionId) {
    setActiveTab(tabId);
    if (tabId === 'login') {
      setSearchParams({ tab: 'login' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
    programmaticScrollRef.current = true;
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 800);
  }

  function resetAuditFilters() {
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
      pageSize: 20,
    }));
  }

  function resetLoginFilters() {
    sessions.setParams(() => ({
      userName: '',
      phone: '',
      actionType: '',
      status: '',
      startDate: '',
      endDate: '',
      branchId: undefined,
      page: 1,
      pageSize: 20,
    }));
  }

  const auditTotalPages = audit.data.total > 0 ? Math.ceil(audit.data.total / (audit.data.pageSize || 20)) : 1;
  const sessionTotalPages = sessions.data.total > 0 ? Math.ceil(sessions.data.total / (sessions.data.pageSize || 20)) : 1;

  return (
    <div className="admin-logs">
      {/* Header */}
      <div className="admin-logs__header">
        <div className="admin-logs__title-block">
          <div className="admin-logs__title-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div className="admin-logs__title-group">
            <h1>Nhật ký hệ thống</h1>
            <p className="admin-logs__subtitle">Theo dõi tất cả hoạt động và lịch sử đăng nhập</p>
          </div>
        </div>
        <div className="admin-logs__actions">
          <LogsTabSwitcher activeTab={activeTab} onTabClick={handleTabClick} />
        </div>
      </div>

      {/* ── Section 1: Audit Log ──────────────────────────────── */}
      <section
        id={SECTION_AUDIT_ID}
        ref={auditSectionRef}
        className="admin-logs__section admin-logs__section--scroll-target"
      >
        <div className="section-header">
          <div className="section-header__left">
            <span
              className="section-header__dot"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }}
            />
            <h2 className="section-header__title">Nhật ký hoạt động</h2>
            {audit.data.total > 0 && (
              <span className="section-header__badge">{audit.data.total}</span>
            )}
          </div>
        </div>

      {/* Filters (Audit) */}
        <div className="filter-card">
          <div className="filter-row">
            <input
              className="input input--search"
              type="text"
              placeholder="Tìm theo tên người dùng..."
              value={audit.params.userName || ''}
              onChange={(e) => audit.updateParam('userName', e.target.value)}
            />
            <input
            className="input input--search"
            type="text"
            placeholder="Tìm theo số điện thoại..."
            value={audit.params.phone || ''}
            onChange={(e) => audit.updateParam('phone', e.target.value)}
          />

          <select
              className="input input--select"
              value={audit.params.action || ''}
              onChange={(e) => audit.updateParam('action', e.target.value)}
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              className="input input--search"
              type="text"
              placeholder="Tìm theo mã (VD: ND-001)..."
              value={audit.params.entityCode || ''}
              onChange={(e) => audit.updateParam('entityCode', e.target.value)}
            />

          <input
            className="input input--date"
            type="date"
            value={audit.params.startDate || ''}
            onChange={(e) => audit.updateParam('startDate', e.target.value)}
            title="Từ ngày"
          />
          <input
            className="input input--date"
            type="date"
            value={audit.params.endDate || ''}
            onChange={(e) => audit.updateParam('endDate', e.target.value)}
            title="Đến ngày"
          />

          <select
            className="input input--select"
            value={audit.params.branchId ?? ''}
            onChange={(e) =>
              audit.updateParam('branchId', e.target.value ? Number(e.target.value) : undefined)
            }
            disabled={!!branchesError}
          >
            <option value="">
              {branchesError ? `Lỗi: ${branchesError}` : 'Tất cả chi nhánh'}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.branchName}</option>
            ))}
          </select>

          <button className="btn btn--ghost" onClick={resetAuditFilters}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
            </svg>
            Đặt lại
          </button>
        </div>
      </div>

      {/* Table (Audit) */}
        <div className="table-card">
          {audit.loading ? (
            <div className="admin-logs__loading">Đang tải danh sách...</div>
          ) : audit.error ? (
            <div className="admin-logs__error">
              <strong>Lỗi:</strong> {audit.error.message || 'Không thể tải danh sách'}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <AuditTable items={audit.data.items} />
              </div>

              <Pagination
                currentPage={audit.data.page || 1}
                totalPages={auditTotalPages}
                total={audit.data.total}
                onChange={(page) => audit.updateParam('page', page)}
                loading={audit.loading}
              />
            </>
          )}
        </div>
      </section>

      {/* ── Section 2: Login Sessions ─────────────────────────── */}
      <section
        id={SECTION_LOGIN_ID}
        ref={loginSectionRef}
        className="admin-logs__section admin-logs__section--scroll-target"
      >
        <div className="section-header">
          <div className="section-header__left">
            <span
              className="section-header__dot"
              style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)' }}
            />
            <h2 className="section-header__title">Lịch sử đăng nhập</h2>
            {sessions.data.total > 0 && (
              <span className="section-header__badge">{sessions.data.total}</span>
            )}
          </div>
        </div>

        <div className="filter-card">
          <div className="filter-row">
            <input
              className="input input--search"
              type="text"
              placeholder="Tìm theo tên người dùng..."
              value={sessions.params.userName || ''}
              onChange={(e) => sessions.updateParam('userName', e.target.value)}
            />
            <input
              className="input input--search"
              type="text"
              placeholder="Tìm theo số điện thoại..."
              value={sessions.params.phone || ''}
              onChange={(e) => sessions.updateParam('phone', e.target.value)}
            />

            <select
              className="input input--select"
              value={sessions.params.actionType || ''}
              onChange={(e) => sessions.updateParam('actionType', e.target.value)}
            >
              {LOGIN_ACTION_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="input input--select"
              value={sessions.params.status || ''}
              onChange={(e) => sessions.updateParam('status', e.target.value)}
            >
              {SESSION_STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>

            <input
              className="input input--date"
              type="date"
              value={sessions.params.startDate || ''}
              onChange={(e) => sessions.updateParam('startDate', e.target.value)}
              title="Từ ngày"
            />
            <input
              className="input input--date"
              type="date"
              value={sessions.params.endDate || ''}
              onChange={(e) => sessions.updateParam('endDate', e.target.value)}
              title="Đến ngày"
            />

            <select
              className="input input--select"
              value={sessions.params.branchId ?? ''}
              onChange={(e) =>
                sessions.updateParam('branchId', e.target.value ? Number(e.target.value) : undefined)
              }
              disabled={!!branchesError}
            >
              <option value="">
                {branchesError ? `Lỗi: ${branchesError}` : 'Tất cả chi nhánh'}
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.branchName}</option>
              ))}
            </select>

            <button className="btn btn--ghost" onClick={resetLoginFilters}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
              </svg>
              Đặt lại
            </button>
          </div>
        </div>

        {/* Table (Login) */}
        <div className="table-card">
          {sessions.loading ? (
            <div className="admin-logs__loading">Đang tải danh sách...</div>
          ) : sessions.error ? (
            <div className="admin-logs__error">
              <strong>Lỗi:</strong> {sessions.error.message || 'Không thể tải danh sách'}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <SessionTable items={sessions.data.items} />
              </div>

              <Pagination
                currentPage={sessions.data.page || 1}
                totalPages={sessionTotalPages}
                total={sessions.data.total}
                onChange={(page) => sessions.updateParam('page', page)}
                loading={sessions.loading}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─── Audit Log Table ─── */
function AuditTable({ items }) {
  if (!items || items.length === 0) {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Người dùng</th>
            <th>Hành động</th>
            <th>Bảng</th>
            <th>Mã / ID</th>
            <th>IP</th>
            <th>Phương thức</th>
            <th>Thời gian xử lý</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={9} className="table__empty">
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
          <th>Người dùng</th>
          <th>Hành động</th>
          <th>Bảng</th>
          <th>Mã / ID</th>
          <th>IP</th>
          <th>Phương thức</th>
          <th>Thời gian xử lý</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const resp = getResponseBadge(item.response_status);
          return (
            <tr key={item.id}>
              <td className="admin-logs__date">{formatDate(item.logged_at)}</td>
              <td>
                <div className="admin-logs__user-cell">
                  <span className="admin-logs__user-name">{item.user_name || '—'}</span>
                  {item.phone_number && (
                    <span className="admin-logs__user-phone">{item.phone_number}</span>
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
              <td className="admin-logs__entity">{item.table_name || item.entity_name || '—'}</td>
              <td className="admin-logs__code">
                {item.entity_code || (item.record_id ? `#${item.record_id}` : '—')}
              </td>
              <td className="admin-logs__ip">{item.ip_address || '—'}</td>
              <td className="admin-logs__method">{item.request_method || '—'}</td>
              <td className="admin-logs__duration">
                {item.duration_ms != null ? `${item.duration_ms}ms` : '—'}
              </td>
              <td>
                {resp ? (
                  <span className={`badge ${resp.cls}`}>{resp.label}</span>
                ) : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
/* ─── Login Session Table ─── */
function SessionTable({ items }) {
  if (!items || items.length === 0) {
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Thời gian đăng nhập</th>
            <th>Người dùng</th>
            <th>Số điện thoại</th>
            <th>Hành động</th>
            <th>Trạng thái</th>
            <th>IP</th>
            <th>Trình duyệt</th>
            <th>Thời gian đăng xuất</th>
            <th>Thời lượng</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={9} className="table__empty">
              Không có lịch sử đăng nhập nào phù hợp với bộ lọc
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
          <th>Thời gian đăng nhập</th>
          <th>Người dùng</th>
          <th>Số điện thoại</th>
          <th>Hành động</th>
          <th>Trạng thái</th>
          <th>IP</th>
          <th>Trình duyệt</th>
          <th>Thời gian đăng xuất</th>
          <th>Thời lượng</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="admin-logs__date">{formatDate(item.login_time)}</td>
            <td className="admin-logs__user-name">{item.user_name || '—'}</td>
            <td className="admin-logs__phone">{item.phone_number || '—'}</td>
            <td>
              {item.action_type ? (
                <span className={`badge ${LOGIN_ACTION_CLASS[item.action_type] || 'badge--secondary'}`}>
                  {LOGIN_ACTION_LABEL[item.action_type] || item.action_type}
                </span>
              ) : '—'}
            </td>
            <td>
              {item.status ? (
                <span className={`badge ${SESSION_STATUS_CLASS[item.status] || 'badge--secondary'}`}>
                  {SESSION_STATUS_LABEL[item.status] || item.status}
                </span>
              ) : '—'}
            </td>
            <td className="admin-logs__ip">{item.ip_address || '—'}</td>
            <td className="admin-logs__user-agent" title={item.user_agent}>
              {item.user_agent
                ? (() => {
                    const match = item.user_agent.match(/Chrome\/[\d.]+|Firefox\/[\d.]+|Safari\/[\d.]+/);
                    return match ? match[0] : item.user_agent.slice(0, 30) + '...';
                  })()
                : '—'}
            </td>
            <td className="admin-logs__date">{formatDate(item.logout_time)}</td>
            <td className="admin-logs__duration">{formatDuration(item.session_duration_seconds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

