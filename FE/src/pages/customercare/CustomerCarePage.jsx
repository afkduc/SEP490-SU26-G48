import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts';
import {
  listMaintenanceRemindersApi,
  markMaintenanceReminderSentApi,
  markMaintenanceReminderConfirmedApi,
} from '../../services/maintenanceReminderApi';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chưa nhắc' },
  { value: 'sent', label: 'Đã nhắc, chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
];

const STATUS_BADGE = {
  pending: { label: 'Chưa nhắc', className: 'badge-pending' },
  sent: { label: 'Đã nhắc, chờ xác nhận', className: 'badge-approved' },
  confirmed: { label: 'Đã xác nhận', className: 'badge-completed' },
};

function reminderStatusOf(r) {
  if (r.isConfirmed) return 'confirmed';
  if (r.isSent) return 'sent';
  return 'pending';
}

// BE tra ve dd/mm/yyyy (toDDMMYYYY) - can parse lai de so sanh voi hom nay.
function parseDDMMYYYY(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

function dueDateMeta(dueDate) {
  const d = parseDDMMYYYY(dueDate);
  if (!d) return {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { color: '#C62828', label: 'Quá hạn' };
  if (diffDays <= 30) return { color: '#E65100', label: 'Sắp đến hạn' };
  return {};
}

function dueKmMeta(dueKm, currentKm) {
  if (!dueKm) return {};
  if ((currentKm || 0) >= dueKm) return { color: '#C62828', label: 'Đã vượt' };
  if (dueKm - (currentKm || 0) <= 1000) return { color: '#E65100', label: 'Sắp đến hạn' };
  return {};
}

// ─── Modal xác nhận khách đồng ý lịch hẹn bảo dưỡng ───────────────────
function ConfirmReminderModal({ reminder, onClose, onConfirmed }) {
  const [confirmedDate, setConfirmedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await markMaintenanceReminderConfirmedApi(reminder.id, { confirmedDate, notes: notes.trim() || undefined });
      onConfirmed();
    } catch (err) {
      setError(err.message || 'Xác nhận thất bại');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Xác nhận lịch hẹn</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            Xe <b>{reminder.vehicle?.licensePlate}</b> — khách hàng <b>{reminder.customer?.fullName}</b>
          </div>
          <div className="form-group">
            <label className="form-label required">Ngày khách hẹn đến</label>
            <input className="form-input" type="date" value={confirmedDate} onChange={(e) => setConfirmedDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Ghi chú</label>
            <textarea
              className="form-textarea"
              placeholder="VD: khách hẹn 9h sáng thứ 7…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <div className="form-error" style={{ marginTop: 6 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Đang lưu…' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Danh sách nhắc nhở bảo dưỡng (tự động sinh từ phiếu quyết toán) ──
export default function CustomerCarePage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [status, debouncedSearch]);

  const load = () => {
    setLoading(true);
    setLoadError('');
    listMaintenanceRemindersApi({ status: status || undefined, search: debouncedSearch || undefined })
      .then((result) => setItems(result || []))
      .catch((err) => setLoadError(err.message || 'Không tải được danh sách nhắc nhở'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, debouncedSearch]);

  const handleMarkSent = async (id) => {
    setBusyId(id);
    setActionError('');
    try {
      await markMaintenanceReminderSentApi(id);
      load();
    } catch (err) {
      setActionError(err.message || 'Đánh dấu thất bại');
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginatedItems = items.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Chăm sóc khách hàng</h1>
          <div className="breadcrumb">Trang chủ / Chăm sóc khách hàng</div>
        </div>
        <div className="page-header-right">
          <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{user?.branchName || user?.branch}</span>
        </div>
      </div>

      {(loadError || actionError) && (
        <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#C62828' }}>
          {loadError || actionError}
        </div>
      )}

      <div className="filter-bar">
        <div className="form-group" style={{ marginBottom: 0, minWidth: 210 }}>
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="search-input">
          <input style={{ paddingLeft: 12 }} placeholder="Tên khách hàng, biển số xe…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-500)' }}>{items.length} nhắc nhở</div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Xe</th><th>Khách hàng</th><th>Hạn bảo dưỡng</th><th>Trạng thái</th><th>Ghi chú</th><th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6}><div className="empty-state"><p>Đang tải danh sách nhắc nhở…</p></div></td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <h3>Chưa có nhắc nhở nào</h3>
                  <p>Hệ thống sẽ tự động tạo nhắc nhở khi phiếu quyết toán có ghi ngày/km bảo dưỡng kế tiếp.</p>
                </div>
              </td></tr>
            )}
            {paginatedItems.map((r) => {
              const st = STATUS_BADGE[reminderStatusOf(r)];
              const dueMeta = dueDateMeta(r.dueDate);
              const kmMeta = dueKmMeta(r.dueKm, r.vehicle?.currentKm);
              const isBusy = busyId === r.id;
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.vehicle?.licensePlate}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.vehicle?.vehicleModel}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.customer?.fullName}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.customer?.phone}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {r.dueDate && (
                      <div style={{ color: dueMeta.color, fontWeight: dueMeta.color ? 700 : 400 }}>
                        {r.dueDate}{dueMeta.label ? ` (${dueMeta.label})` : ''}
                      </div>
                    )}
                    {r.dueKm != null && (
                      <div style={{ color: kmMeta.color, fontWeight: kmMeta.color ? 700 : 400 }}>
                        {r.dueKm.toLocaleString('vi-VN')} km{kmMeta.label ? ` (${kmMeta.label})` : ''}
                      </div>
                    )}
                    {!r.dueDate && r.dueKm == null && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                  </td>
                  <td><span className={`badge ${st.className}`}>{st.label}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--gray-600)', maxWidth: 200 }}>{r.notes || '—'}</td>
                  <td>
                    <div className="table-actions" style={{ flexWrap: 'nowrap' }}>
                      {!r.isSent && (
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} disabled={isBusy} onClick={() => handleMarkSent(r.id)}>
                          {isBusy ? 'Đang lưu…' : 'Đã nhắc khách'}
                        </button>
                      )}
                      {!r.isConfirmed && (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => setConfirmTarget(r)}>Xác nhận lịch hẹn</button>
                      )}
                      {r.isConfirmed && (
                        <span style={{ fontSize: 11, color: '#2E7D32', fontWeight: 700 }}>Hẹn ngày {r.confirmedDate}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 12, color: 'var(--gray-500)' }}>
          <div>Tổng {items.length} nhắc nhở</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>Trước</button>
            <span>Trang {pageSafe}/{totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau</button>
          </div>
        </div>
      )}

      {confirmTarget && (
        <ConfirmReminderModal
          reminder={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={() => { setConfirmTarget(null); load(); }}
        />
      )}
    </div>
  );
}
