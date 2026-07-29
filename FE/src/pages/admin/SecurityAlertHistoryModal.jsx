import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  buildSessionSeedFromAlert,
  describeAlertFocus,
  parseAlertMeta,
} from './securityAlertFocus';
import './SecurityAlertHistoryModal.css';

const SEVERITY_LABEL = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  info: 'Info',
};

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(value);
  }
}

/**
 * Popup tóm tắt cảnh báo.
 * Lịch sử đầy đủ (các lần trùng + phiên) xem trên tab Lịch sử.
 */
export default function SecurityAlertHistoryModal({ alert, onClose, onOpenFullHistory }) {
  const meta = parseAlertMeta(alert?.metadata);
  const seed = buildSessionSeedFromAlert(alert);
  const ip = String(meta.ipAddress || meta.ip || seed?.ipAddress || '').trim();
  const context = describeAlertFocus(alert);
  const dupHint = Number(alert?.duplicateCount) > 1
    ? `${alert.duplicateCount} lần cùng loại (xem đủ trên tab Lịch sử)`
    : null;

  useEffect(() => {
    if (!alert) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [alert, onClose]);

  if (!alert) return null;

  const modal = (
    <div
      className="sec-hist-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        className="sec-hist-modal sec-hist-modal--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sec-hist-modal-title"
      >
        <header className="sec-hist-modal__header">
          <div>
            <h2 id="sec-hist-modal-title">Chi tiết cảnh báo</h2>
            <p className="sec-hist-modal__subtitle">{context || alert.title}</p>
          </div>
          <button type="button" className="sec-hist-modal__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>

        <div className="sec-hist-modal__alert">
          <div className="sec-hist-modal__alert-top">
            <span className={`sec-hist-sev sec-hist-sev--${alert.severity || 'info'}`}>
              {SEVERITY_LABEL[alert.severity] || alert.severity || '—'}
            </span>
            <span className="sec-hist-modal__time">{formatDateTime(alert.createdAt)}</span>
          </div>
          <div className="sec-hist-modal__alert-title">{alert.title}</div>
          <div className="sec-hist-modal__alert-msg">{alert.message}</div>
          {dupHint && (
            <p className="sec-hist-modal__dup-hint">{dupHint}</p>
          )}
          <dl className="sec-hist-modal__meta">
            {ip && (
              <>
                <dt>IP</dt>
                <dd><code>{ip}</code></dd>
              </>
            )}
            {(alert.userName || meta.userName || alert.displayName) && (
              <>
                <dt>Tài khoản</dt>
                <dd>{alert.displayName || alert.userName || meta.userName}</dd>
              </>
            )}
            {meta.count != null && (
              <>
                <dt>Số lần</dt>
                <dd>{meta.count}</dd>
              </>
            )}
            {(meta.browser || meta.os) && (
              <>
                <dt>Thiết bị</dt>
                <dd>{[meta.browser, meta.os].filter(Boolean).join(' · ')}</dd>
              </>
            )}
            <dt>Đối chiếu</dt>
            <dd>Phiên / thiết bị mới nhất trong bộ lọc</dd>
          </dl>
        </div>

        <p className="sec-hist-modal__guide">
          Để xem <strong>đầy đủ các lần cảnh báo cùng loại</strong> và bảng phiên đăng nhập đã lọc,
          mở tab Lịch sử bên dưới.
        </p>

        <footer className="sec-hist-modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Đóng
          </button>
          {typeof onOpenFullHistory === 'function' && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                onOpenFullHistory(alert);
                onClose?.();
              }}
            >
              Mở đầy đủ tab Lịch sử
            </button>
          )}
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
