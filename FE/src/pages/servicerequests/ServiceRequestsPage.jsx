import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AppContext';
import { useServiceRequests } from '../../contexts/ServiceRequestsContext';
import { formatDateSafe, vnPartsToIsoUtc } from '../../utils/dateUtils';
import {
  acceptServiceRequest,
  createAppointment,
  updateAppointment,
  cancelAppointment,
} from '../../services/serviceRequestApi';
import './ServiceRequestsPage.css';

const GENDER_LABELS = { nam: 'Nam', nu: 'Nữ', khac: 'Khác' };
const STATUS_LABELS = { pending: 'Chưa tiếp nhận', accepted: 'Đã tiếp nhận', cancelled: 'Đã huỷ' };
const STATUS_BADGE_CLASS = { pending: 'badge-pending', accepted: 'badge-completed', cancelled: 'badge-cancelled' };

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chưa tiếp nhận' },
  { value: 'accepted', label: 'Đã tiếp nhận' },
  { value: 'cancelled', label: 'Đã huỷ' },
];

// Trang thai LICH HEN (khac voi trang thai YEU CAU o tren) - loc rieng vi 1
// yeu cau "Da tiep nhan" co the chua co lich hen, dang co lich, hoac lich da
// bi huy (CVDV huy roi nhung yeu cau goc van "Da tiep nhan").
const APPOINTMENT_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả lịch hẹn' },
  { value: 'none', label: 'Chưa có lịch hẹn' },
  { value: 'scheduled', label: 'Đã lên lịch' },
  { value: 'cancelled', label: 'Đã huỷ lịch hẹn' },
];

// Luon khoa timezone Asia/Ho_Chi_Minh khi format (giong formatDateSafe dang
// dung o cac trang khac) - KHONG dung toLocaleString mac dinh vi no doc theo
// timezone cua trinh duyet/OS, tung gay lech gio trong du an nay (xem ghi
// chu trong utils/dateUtils.js).
function formatDateTime(value) {
  return formatDateSafe(value, { timeZone: 'Asia/Ho_Chi_Minh' });
}

// Tach 1 Date thanh { date: 'YYYY-MM-DD', time: 'HH:mm' } theo dung gio Viet
// Nam - de dien san input date/time khi sua lich hen. KHONG dung
// toISOString()/toTimeString() vi 2 ham do doc theo UTC/timezone trinh
// duyet, co the lech gio giong loi da gap o formatDateTime.
function toVNDateTimeParts(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export default function ServiceRequestsPage() {
  const { user } = useAuth();
  const { requests, refetch } = useServiceRequests();
  const [busyId, setBusyId] = useState(null);
  const [apptTarget, setApptTarget] = useState(null); // { request, appointment }
  const [cancelTarget, setCancelTarget] = useState(null); // { request, appointment }
  const [detailTarget, setDetailTarget] = useState(null); // request
  const [error, setError] = useState('');

  // Bo loc - deu ap dung tren du lieu da tai san (requests tu context, khong
  // goi lai API) va co the ket hop tu do (loc kep): tim kiem + trang thai yeu
  // cau + trang thai lich hen + chi nhanh + khoang ngay gui + "chi cua toi".
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [apptFilter, setApptFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const branchOptions = useMemo(() => {
    const set = new Set(requests.map((r) => r.nearestBranchName).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const counts = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      accepted: requests.filter((r) => r.status === 'accepted').length,
      cancelled: requests.filter((r) => r.status === 'cancelled').length,
    }),
    [requests]
  );

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter || apptFilter || branchFilter || onlyMine || fromDate || toDate
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setApptFilter('');
    setBranchFilter('');
    setOnlyMine(false);
    setFromDate('');
    setToDate('');
  };

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
    return requests.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (apptFilter === 'none' && r.appointment) return false;
      if (apptFilter === 'scheduled' && r.appointment?.status !== 'scheduled') return false;
      if (apptFilter === 'cancelled' && r.appointment?.status !== 'cancelled') return false;
      if (branchFilter && r.nearestBranchName !== branchFilter) return false;
      if (onlyMine && String(r.acceptedBy) !== String(user?.id)) return false;
      const createdAt = r.createdAt ? new Date(r.createdAt) : null;
      if (from && (!createdAt || createdAt < from)) return false;
      if (to && (!createdAt || createdAt > to)) return false;
      if (term) {
        const haystack = `${r.fullName || ''} ${r.phone || ''} ${r.email || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [requests, search, statusFilter, apptFilter, branchFilter, onlyMine, fromDate, toDate, user?.id]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, apptFilter, branchFilter, onlyMine, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginatedRequests = filteredRequests.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  async function handleAccept(request) {
    setBusyId(request.id);
    setError('');
    try {
      await acceptServiceRequest(request.id);
      await refetch();
    } catch (err) {
      setError(err.message || 'Không thể tiếp nhận yêu cầu này');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveAppointment(payload) {
    const { request, appointment } = apptTarget;
    if (appointment) {
      await updateAppointment(request.id, appointment.id, payload);
    } else {
      await createAppointment(request.id, payload);
    }
    setApptTarget(null);
    await refetch();
  }

  async function handleConfirmCancel(reason) {
    const { request, appointment } = cancelTarget;
    await cancelAppointment(request.id, appointment.id, reason);
    setCancelTarget(null);
    await refetch();
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Yêu cầu tư vấn từ khách hàng</h1>
          <div className="breadcrumb">Trang chủ / Yêu cầu</div>
        </div>
      </div>

      <div className="sr-stats">
        <div className="sr-stat">
          <span className="sr-stat__value">{counts.total}</span>
          <span className="sr-stat__label">Tổng yêu cầu</span>
        </div>
        <div className="sr-stat sr-stat--pending">
          <span className="sr-stat__value">{counts.pending}</span>
          <span className="sr-stat__label">Chưa tiếp nhận</span>
        </div>
        <div className="sr-stat sr-stat--accepted">
          <span className="sr-stat__value">{counts.accepted}</span>
          <span className="sr-stat__label">Đã tiếp nhận</span>
        </div>
        <div className="sr-stat sr-stat--cancelled">
          <span className="sr-stat__value">{counts.cancelled}</span>
          <span className="sr-stat__label">Đã huỷ</span>
        </div>
      </div>

      {error && <div className="form-error" style={{ margin: '0 0 16px' }}>{error}</div>}

      <div className="filter-bar">
        <div className="search-input">
          <input placeholder="Tên khách hàng, SĐT, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 170 }}>
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 170 }}>
          <select className="form-select" value={apptFilter} onChange={(e) => setApptFilter(e.target.value)}>
            {APPOINTMENT_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {branchOptions.length > 0 && (
          <div className="form-group" style={{ marginBottom: 0, minWidth: 170 }}>
            <select className="form-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">Tất cả chi nhánh</option>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Từ ngày</label>
          <input className="form-input" type="date" style={{ width: 150 }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Đến ngày</label>
          <input className="form-input" type="date" style={{ width: 150 }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-700)', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Của tôi
        </label>
        {hasActiveFilters && (
          <button className="btn btn-secondary btn-sm" onClick={resetFilters}>Xoá lọc</button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-500)', alignSelf: 'center' }}>
          {filteredRequests.length} / {counts.total} yêu cầu
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="empty-state">
          <h3>Không có yêu cầu nào</h3>
          <p>{counts.total === 0 ? 'Chưa có yêu cầu nào được gửi từ landing page.' : 'Không có yêu cầu nào khớp với bộ lọc hiện tại.'}</p>
        </div>
      ) : (
        <>
          <div className="sr-list">
            {paginatedRequests.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                currentUserId={user?.id}
                busy={busyId === r.id}
                onAccept={() => handleAccept(r)}
                onCreateAppointment={() => setApptTarget({ request: r, appointment: null })}
                onEditAppointment={() => setApptTarget({ request: r, appointment: r.appointment })}
                onCancelAppointment={() => setCancelTarget({ request: r, appointment: r.appointment })}
                onViewDetail={() => setDetailTarget(r)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12, color: 'var(--gray-500)' }}>
            <div>Trang {pageSafe}/{totalPages}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>Trước</button>
              <button className="btn btn-secondary btn-sm" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau</button>
            </div>
          </div>
        </>
      )}

      {apptTarget && (
        <AppointmentModal
          target={apptTarget}
          onClose={() => setApptTarget(null)}
          onSave={handleSaveAppointment}
        />
      )}

      {cancelTarget && (
        <CancelReasonModal
          title="Huỷ lịch hẹn"
          onClose={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {detailTarget && <DetailModal request={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  );
}

function RequestCard({
  request,
  currentUserId,
  busy,
  onAccept,
  onCreateAppointment,
  onEditAppointment,
  onCancelAppointment,
  onViewDetail,
}) {
  const isMine = request.acceptedBy != null && String(request.acceptedBy) === String(currentUserId);
  const appt = request.appointment;

  return (
    <div className="sr-card">
      <div className="sr-card__head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <h3 style={{ margin: 0 }}>{request.fullName}</h3>
            <span className={`badge ${STATUS_BADGE_CLASS[request.status]}`}>{STATUS_LABELS[request.status]}</span>
          </div>
          <a href={`tel:${request.phone}`} className="sr-card__phone">{request.phone}</a>
        </div>
        <span className="sr-card__time">{formatDateTime(request.createdAt)}</span>
      </div>

      <p className="sr-card__issue">{request.issueDescription}</p>

      <div className="sr-card__meta">
        <span>
          Chi nhánh mua xe: {request.purchaseBranchName || request.purchaseBranchOther || 'Không rõ'}
        </span>
        {(request.vehicleBrandName || request.vehicleBrandOther) && (
          <span>Hãng xe: {request.vehicleBrandName || request.vehicleBrandOther}</span>
        )}
        {request.email && <span>Email: {request.email}</span>}
        {request.address && <span>Địa chỉ: {request.address}</span>}
      </div>

      {appt && (
        <div className={`sr-appt sr-appt--${appt.status}`}>
          <strong>Lịch hẹn: {formatDateTime(appt.appointmentAt)}</strong>
          {appt.notes && <p>{appt.notes}</p>}
          {appt.status === 'cancelled' && (
            <p className="sr-appt__cancel-reason">Đã huỷ - Lý do: {appt.cancelReason}</p>
          )}
        </div>
      )}

      <div className="sr-card__actions">
        {request.status === 'pending' && (
          <button className="btn btn-info btn-sm" disabled={busy} onClick={onAccept}>
            {busy ? 'Đang xử lý...' : 'Tiếp nhận'}
          </button>
        )}

        {request.status === 'accepted' && !isMine && (
          <button className="btn btn-secondary btn-sm" disabled>
            Đã tiếp nhận bởi {request.acceptedByName || 'CVDV khác'}
          </button>
        )}

        {request.status === 'accepted' && isMine && (
          <>
            <button className="btn sr-btn-success btn-sm" disabled>
              Đã tiếp nhận
            </button>
            {(!appt || appt.status === 'cancelled') && (
              <button className="btn btn-primary btn-sm" onClick={onCreateAppointment}>
                Tạo lịch hẹn
              </button>
            )}
            {appt && appt.status === 'scheduled' && (
              <>
                <button className="btn btn-warning btn-sm" onClick={onEditAppointment}>
                  Sửa
                </button>
                <button className="btn btn-danger btn-sm" onClick={onCancelAppointment}>
                  Hủy
                </button>
              </>
            )}
          </>
        )}

        <button className="btn btn-primary btn-sm" onClick={onViewDetail}>
          Xem chi tiết
        </button>
      </div>
    </div>
  );
}

// ─── Modal tao/sua lich hen ────────────────────────────────────────────
function AppointmentModal({ target, onClose, onSave }) {
  const { request, appointment } = target;
  const initial = appointment?.appointmentAt ? new Date(appointment.appointmentAt) : null;
  const initialParts = initial ? toVNDateTimeParts(initial) : null;
  const [date, setDate] = useState(initialParts?.date || '');
  const [time, setTime] = useState(initialParts?.time || '');
  const [notes, setNotes] = useState(appointment?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!date || !time) {
      setError('Vui lòng chọn đầy đủ ngày và giờ hẹn');
      return;
    }
    const appointmentAt = vnPartsToIsoUtc(date, time);
    if (new Date(appointmentAt).getTime() < Date.now()) {
      setError('Không thể chọn ngày giờ hẹn trong quá khứ');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSave({ appointmentAt, notes: notes.trim() || null });
    } catch (err) {
      setError(err.message || 'Lưu thất bại');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{appointment ? 'Sửa lịch hẹn' : 'Tạo lịch hẹn'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="sr-modal-customer">{request.fullName} — {request.phone}</p>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Ngày hẹn</label>
              <input
                type="date"
                className="form-input"
                value={date}
                min={toVNDateTimeParts(new Date()).date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Giờ hẹn</label>
              <input
                type="time"
                className="form-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Ghi chú</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <div className="form-error" style={{ marginTop: 6 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Huỷ
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal nhap ly do huy lich hen (mau theo CancelReasonModal cua RepairSettlementPage) ──
function CancelReasonModal({ title, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do hủy');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err.message || 'Hủy thất bại');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label required">Lý do hủy</label>
            <textarea
              className="form-textarea"
              placeholder="Nhập lý do hủy lịch hẹn…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
          {error && <div className="form-error" style={{ marginTop: 6 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Trở lại
          </button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Đang xử lý…' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal xem chi tiet (read-only) ───────────────────────────────────
function DetailModal({ request, onClose }) {
  const appt = request.appointment;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Chi tiết yêu cầu</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body sr-detail">
          <div><span>Họ và tên</span><strong>{request.fullName}</strong></div>
          <div><span>Giới tính</span><strong>{GENDER_LABELS[request.gender] || '-'}</strong></div>
          <div><span>Số điện thoại</span><strong>{request.phone}</strong></div>
          <div><span>Email</span><strong>{request.email || '-'}</strong></div>
          <div><span>Địa chỉ</span><strong>{request.address || '-'}</strong></div>
          <div>
            <span>Chi nhánh mua xe</span>
            <strong>{request.purchaseBranchName || request.purchaseBranchOther || '-'}</strong>
          </div>
          <div>
            <span>Hãng xe</span>
            <strong>{request.vehicleBrandName || request.vehicleBrandOther || '-'}</strong>
          </div>
          <div><span>Chi nhánh gần nhất</span><strong>{request.nearestBranchName}</strong></div>
          <div><span>Vấn đề gặp phải</span><strong>{request.issueDescription}</strong></div>
          <div><span>Trạng thái</span><strong><span className={`badge ${STATUS_BADGE_CLASS[request.status]}`}>{STATUS_LABELS[request.status] || request.status}</span></strong></div>
          <div><span>Người tiếp nhận</span><strong>{request.acceptedByName || '-'}</strong></div>
          <div><span>Thời gian gửi</span><strong>{formatDateTime(request.createdAt)}</strong></div>
          {appt && (
            <>
              <div><span>Lịch hẹn</span><strong>{formatDateTime(appt.appointmentAt)}</strong></div>
              <div><span>Ghi chú lịch hẹn</span><strong>{appt.notes || '-'}</strong></div>
              <div>
                <span>Trạng thái lịch hẹn</span>
                <strong>{appt.status === 'cancelled' ? `Đã huỷ (${appt.cancelReason})` : 'Đã lên lịch'}</strong>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
