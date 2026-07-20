import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AppContext';
import { useNotifications } from '../hooks/useNotifications';
import { formatDateSafe } from '../utils/dateUtils';
import './NotificationBell.css';

const ICON_COLORS = {
  LOGIN_SUCCESS: '#10b981',
  LOGIN_FAILED: '#ef4444',
  NEW_DEVICE: '#f59e0b',
  FORCE_LOGOUT: '#ef4444',
  PASSWORD_CHANGED: '#3b82f6',
  ROLE_CHANGED: '#8b5cf6',
};

const ICON_LABELS = {
  LOGIN_SUCCESS: 'Đăng nhập',
  LOGIN_FAILED: 'Thất bại',
  NEW_DEVICE: 'Thiết bị mới',
  FORCE_LOGOUT: 'Bị đăng xuất',
  PASSWORD_CHANGED: 'Mật khẩu',
  ROLE_CHANGED: 'Phân quyền',
};

function getIcon(notif) {
  const color = ICON_COLORS[notif.type] || '#64748b';
  const label = ICON_LABELS[notif.type] || notif.type;
  return (
    <span
      className="notif-bell__item-icon"
      style={{ background: color }}
      aria-hidden
    >
      {label.charAt(0)}
    </span>
  );
}

/**
 * NotificationBell - bell icon voi badge dem unread, click mo dropdown
 * danh sach notification moi nhat.
 *
 * Hook vao useNotifications (SSE realtime + poll fallback).
 */
export default function NotificationBell() {
  const { token } = useAuth();
  const {
    notifications,
    unreadCount,
    connected,
    loading,
    markRead,
    markAllRead,
    refresh,
  } = useNotifications(token);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown khi click ngoai
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close bang ESC
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleItemClick = useCallback((notif) => {
    if (!notif.isRead && !notif.readAt) {
      markRead(notif.id);
    }
    // Co the navigate den chi tiet neu notif.metadata co link (optional)
  }, [markRead]);

  return (
    <div className="notif-bell" ref={dropdownRef}>
      <button
        type="button"
        className={`notif-bell__trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
        aria-expanded={open}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell__badge" aria-hidden>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* Dot nho the hien SSE connect status */}
        <span
          className={`notif-bell__status notif-bell__status--${connected ? 'ok' : 'off'}`}
          aria-label={connected ? 'Realtime connected' : 'Realtime disconnected'}
        />
      </button>

      {open && (
        <div className="notif-bell__dropdown" role="menu">
          <div className="notif-bell__header">
            <h3>Thông báo</h3>
            <div className="notif-bell__header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-bell__action"
                  onClick={markAllRead}
                >
                  Đánh dấu tất cả đã đọc
                </button>
              )}
              <button
                type="button"
                className="notif-bell__action"
                onClick={refresh}
                aria-label="Làm mới"
              >
                ↻
              </button>
            </div>
          </div>

          <div className="notif-bell__list">
            {loading && notifications.length === 0 ? (
              <div className="notif-bell__empty">Đang tải...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-bell__empty">Không có thông báo nào</div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.isRead && !notif.readAt;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    className={`notif-bell__item ${isUnread ? 'is-unread' : ''}`}
                    onClick={() => handleItemClick(notif)}
                    role="menuitem"
                  >
                    {getIcon(notif)}
                    <div className="notif-bell__item-body">
                      <div className="notif-bell__item-title">
                        {notif.title || ICON_LABELS[notif.type] || 'Thông báo'}
                      </div>
                      <div className="notif-bell__item-message">
                        {notif.message || ''}
                      </div>
                      <div className="notif-bell__item-time">
                        {formatDateSafe(notif.createdAt || notif.timestamp, {
                          timeZone: 'Asia/Ho_Chi_Minh',
                          locale: 'vi-VN',
                        })}
                      </div>
                    </div>
                    {isUnread && (
                      <span className="notif-bell__item-dot" aria-hidden />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
