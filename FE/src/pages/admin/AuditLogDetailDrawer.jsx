import UserDetailDrawer from './users/UserDetailDrawer';
import { useState } from 'react';
import './AdminLogDrawers.css';

const ACTION_LABELS = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatJson(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    return value;
  }
}

function JsonBlock({ label, data }) {
  const obj = formatJson(data);
  if (obj === null || obj === '') return null;
  let display;
  if (typeof obj === 'object') {
    try {
      display = JSON.stringify(obj, null, 2);
    } catch {
      display = String(obj);
    }
  } else {
    display = String(obj);
  }
  return (
    <div className="detail-list__group">
      <div className="detail-list__group-title">{label}</div>
      <pre className="audit-detail__json">{display}</pre>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="detail-list__item">
      <dt>{label}</dt>
      <dd className={mono ? 'font-mono' : ''}>
        {value || <span style={{ color: '#cbd5e1' }}>—</span>}
      </dd>
    </div>
  );
}

function ResponseBadge({ status }) {
  if (status === null || status === undefined) return null;
  let cls = 'badge--secondary';
  if (status >= 200 && status < 300) cls = 'badge--success';
  else if (status >= 400 && status < 500) cls = 'badge--warning';
  else if (status >= 500) cls = 'badge--danger';
  return <span className={`badge ${cls}`}>{status}</span>;
}

function ActionBadge({ action }) {
  if (!action) return null;
  const upper = String(action).toUpperCase();
  let cls = 'badge--secondary';
  let label = action;
  if (upper.includes('CREATE') || upper.includes('INSERT')) {
    cls = 'badge--success'; label = ACTION_LABELS.CREATE;
  } else if (upper.includes('UPDATE') || upper.includes('EDIT') || upper.includes('MODIFY') || upper.includes('PATCH')) {
    cls = 'badge--info'; label = ACTION_LABELS.UPDATE;
  } else if (upper.includes('DELETE') || upper.includes('REMOVE')) {
    cls = 'badge--danger'; label = ACTION_LABELS.DELETE;
  }
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function AuditLogDetailDrawer({ log, onClose, onViewUser }) {
  const [showUser, setShowUser] = useState(false);

  if (!log) return null;

  const fullName = log.user_name || '—';
  const phone = log.phone_number || '';

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="drawer">
        <div className="drawer__header">
          <div className="drawer__title-block">
            <div className="drawer__title-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h2 className="drawer__title">Chi tiết nhật ký</h2>
          </div>
          <button className="drawer__close" onClick={onClose} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="drawer__body">
          {/* User card */}
          <div className="user-info-card">
            <div className="user-info-card__avatar">
              {fullName.split(' ').filter(Boolean).slice(-2).map((p) => p[0]).join('').toUpperCase() || '?'}
            </div>
            <h3 className="user-info-card__name">{fullName}</h3>
            <p className="user-info-card__username">
              {phone && `· ${phone}`}
            </p>
            <div style={{ marginTop: 10 }}>
              <ActionBadge action={log.action} />
            </div>
          </div>

          {/* Thong tin co ban */}
          <dl className="detail-list">
            <div className="detail-list__group">
              <div className="detail-list__group-title">Thông tin hành động</div>
            </div>
            <div className="detail-list__group">
              <DetailRow label="ID log" value={`#${log.id}`} mono />
              <DetailRow label="Thời gian" value={formatDateTime(log.logged_at || log.created_at)} />
              <DetailRow label="Hành động" value={
                <ActionBadge action={log.action} />
              } />
              <DetailRow label="Phương thức HTTP" value={log.request_method} mono />
              <DetailRow label="URL" value={log.request_url} mono />
              <DetailRow label="Trạng thái" value={
                <ResponseBadge status={log.response_status} />
              } />
              <DetailRow label="Thời gian xử lý" value={log.duration_ms != null ? `${log.duration_ms}ms` : null} />
            </div>

            <div className="detail-list__group">
              <div className="detail-list__group-title">Đối tượng tác động</div>
            </div>
            <div className="detail-list__group">
              <DetailRow label="Bảng" value={log.table_name || log.entity_name} />
              <DetailRow label="Mã bản ghi" value={log.entity_code} mono />
              <DetailRow label="Record ID" value={log.record_id != null ? `#${log.record_id}` : null} mono />
              <DetailRow label="Mô tả" value={log.description} />
            </div>

            <div className="detail-list__group">
              <div className="detail-list__group-title">Người dùng</div>
            </div>
            <div className="detail-list__group">
              <DetailRow label="Họ tên" value={fullName} />
              <DetailRow label="Số điện thoại" value={phone} />
              <DetailRow label="User ID" value={log.user_id != null ? `#${log.user_id}` : null} mono />
              <DetailRow label="IP" value={log.ip_address} mono />
              <DetailRow label="Chi nhánh" value={log.branch_name || (log.branch_id ? `Chi nhánh #${log.branch_id}` : null)} />
            </div>
          </dl>

          {/* Request body */}
          <JsonBlock label="Request body" data={log.request_body} />
          <JsonBlock label="Response body" data={log.response_body} />
          <JsonBlock label="Old value" data={log.old_value} />
          <JsonBlock label="New value" data={log.new_value} />
        </div>

        <div className="drawer__footer">
          {log.user_id && (
            <button className="drawer__btn-assign" onClick={() => setShowUser(true)} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Xem người dùng
            </button>
          )}
        </div>

        {showUser && log.user_id && (
          <UserDetailDrawer
            userId={log.user_id}
            onClose={() => setShowUser(false)}
            onRolesChanged={() => setShowUser(false)}
          />
        )}
      </div>
    </div>
  );
}