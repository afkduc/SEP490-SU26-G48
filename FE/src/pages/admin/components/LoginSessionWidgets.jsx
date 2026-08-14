import { useState, useEffect } from 'react';
import AdminPagination from './AdminPagination';
import { formatPhoneDisplay } from '../../../utils/validation';
import {
  ACTION_CLASS,
  ACTION_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  formatDate,
  formatDuration,
  liveDurationSeconds,
} from './loginSessionFormatters';
import { IconTotal, IconLogin, IconActive, IconFailed } from './LoginSessionIcons';

function useDurationTicker(intervalMs = 30000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

export function StatsCards({ stats, loading }) {
  const counts = stats || { total: 0, loginCount: 0, failedCount: 0, activeCount: 0 };

  const cards = [
    {
      icon: <IconTotal />,
      iconCls: 'stat-card__icon--gray',
      value: counts.total,
      label: 'Tổng phiên',
    },
    {
      icon: <IconLogin />,
      iconCls: 'stat-card__icon--green',
      value: counts.loginCount,
      label: 'Đăng nhập thành công',
    },
    {
      icon: <IconActive />,
      iconCls: 'stat-card__icon--cyan',
      value: counts.activeCount,
      label: 'Đang hoạt động',
    },
    {
      icon: <IconFailed />,
      iconCls: 'stat-card__icon--red',
      value: counts.failedCount,
      label: 'Thất bại',
    },
  ];

  return (
    <div className="admin-sessions__stats">
      {cards.map((c, i) => (
        <div key={i} className="stat-card">
          <div className={`stat-card__icon ${c.iconCls}`}>{c.icon}</div>
          <div className="stat-card__content">
            <span className="stat-card__value">{loading ? '—' : c.value}</span>
            <span className="stat-card__label">{c.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────

export function Pagination({ currentPage, totalPages, total, onChange, loading }) {
  return (
    <AdminPagination
      currentPage={currentPage}
      totalPages={totalPages}
      total={total}
      onChange={onChange}
      loading={loading}
      accent="cyan"
    />
  );
}

// ─── Table Skeleton ────────────────────────────────────────────────

export const SESSION_COLS = (
  <colgroup>
    <col style={{ width: '20%' }} />
    <col style={{ width: '20%' }} />
    <col style={{ width: '20%' }} />
    <col style={{ width: '20%' }} />
    <col style={{ width: '20%' }} />
  </colgroup>
);

export function TableSkeleton({ rows }) {
  return (
    <table className="table admin-sessions__table">
      {SESSION_COLS}
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Người dùng</th>
          <th>Sự kiện</th>
          <th>Thời lượng</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            {[...Array(5)].map((__, j) => (
              <td key={j}>
                <div
                  className="skeleton-line"
                  style={{ width: `${50 + ((i * 7 + j * 13) % 40)}%` }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Session Table ─────────────────────────────────────────────────

export function SessionTable({ items, onViewSession, focusedSessionId = null }) {
  useDurationTicker(30000);

  const head = (
    <thead>
      <tr>
        <th>Thời gian</th>
        <th>Người dùng</th>
        <th>Sự kiện</th>
        <th>Thời lượng</th>
        <th>Thao tác</th>
      </tr>
    </thead>
  );

  if (!items || items.length === 0) {
    return (
      <table className="table admin-sessions__table">
        {SESSION_COLS}
        {head}
        <tbody>
          <tr>
            <td colSpan={5} className="table__empty">
              Không có lịch sử đăng nhập nào phù hợp với bộ lọc
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <table className="table admin-sessions__table">
      {SESSION_COLS}
      {head}
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            id={`admin-session-row-${item.id}`}
            className={
              Number(focusedSessionId) === Number(item.id) ? 'admin-sessions__row--focused' : ''
            }
          >
            <td>
              <span className="admin-sessions__date">{formatDate(item.login_time)}</span>
            </td>
            <td>
              <div className="admin-sessions__user-cell">
                <span className="admin-sessions__user-name">{item.user_name || '—'}</span>
                <span className="admin-sessions__phone">
                  {item.phone_number ? formatPhoneDisplay(item.phone_number) : '—'}
                </span>
              </div>
            </td>
            <td>
              <div className="admin-sessions__event-cell">
                {item.action_type ? (
                  <span className={`badge ${ACTION_CLASS[item.action_type] || 'badge--secondary'}`}>
                    {ACTION_LABEL[item.action_type] || item.action_type}
                  </span>
                ) : (
                  <span className="badge badge--secondary">—</span>
                )}
                {item.status ? (
                  <span className={`badge ${STATUS_CLASS[item.status] || 'badge--secondary'}`}>
                    {STATUS_LABEL[item.status] || item.status}
                  </span>
                ) : null}
              </div>
            </td>
            <td>
              <span className="admin-sessions__duration">
                {item.status === 'active' ? (
                  <span style={{ color: '#0891b2', fontWeight: 600 }}>
                    {formatDuration(liveDurationSeconds(item.login_time)) || '—'}
                  </span>
                ) : (
                  formatDuration(item.session_duration_seconds) || '—'
                )}
              </span>
            </td>
            <td>
              <div className="admin-sessions__row-actions">
                <button
                  type="button"
                  className="admin-sessions__action-btn admin-sessions__action-btn--primary"
                  onClick={() => onViewSession?.(item)}
                  title="Xem chi tiết phiên"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="admin-sessions__action-label">Chi tiết</span>
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
