import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { usePermission } from '../../contexts/PermissionContext';
import { formatCurrency, formatDate } from '../../utils';
import managerApi from '../../services/managerApi';
import { PermissionGate } from '../../components/PermissionGate';
import ManagerImportRequestListPage from './ManagerImportRequestListPage';
import ManagerImportRequestDetailPage from './ManagerImportRequestDetailPage';
import ManagerExportRequestListPage from './ManagerExportRequestListPage';
import ManagerExportRequestDetailPage from './ManagerExportRequestDetailPage';
import ManagerDashboardPage from './ManagerDashboardPage';
import ManagerInventoryPage from './ManagerInventoryPage';
import SettlementDetailModal, { settlementStatusBadge } from './SettlementDetailModal';

const SERVICE_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang áp dụng' },
  { value: 'inactive', label: 'Ngừng áp dụng' },
];

function activeBadge(isActive) {
  return isActive
    ? { label: 'Đang áp dụng', className: 'badge-active' }
    : { label: 'Ngừng áp dụng', className: 'badge-inactive' };
}

const SETTLEMENT_STATUS_TABS = [
  { value: 'waiting_repair', label: 'Chờ sửa chữa' },
  { value: 'inprogress', label: 'Đang sửa chữa' },
  { value: 'waiting_payment', label: 'Chờ thanh toán' },
  { value: 'invoiced', label: 'Đã xuất hóa đơn' },
  { value: 'cancelled', label: 'Đã hủy' },
];


// Ngoai "Ngay tiep nhan" (luon loc duoc o moi tab tru "Tat ca"), moi tab con
// co the loc them theo 1 moc thoi gian rieng phan anh dung y nghia cua tab do -
// "Cho sua chua"/"Dang sua chua" chi co ngay tiep nhan nen khong co field thu 2.
const SETTLEMENT_SECONDARY_DATE_FIELD_BY_TAB = {
  waiting_payment: { key: 'completedDate', label: 'Ngày hoàn thành' },
  invoiced: { key: 'paidAt', label: 'Ngày xuất hóa đơn' },
  cancelled: { key: 'cancelledAt', label: 'Ngày hủy' },
};

// day/month/year rong ('') = khong loc theo phan do (vd chi chon Thang + Nam
// -> loc theo ca thang, khong can biet dung ngay nao).
function settlementDateMatches(value, day, month, year) {
  if (!day && !month && !year) return true;
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  if (day && d.getDate() !== Number(day)) return false;
  if (month && d.getMonth() + 1 !== Number(month)) return false;
  if (year && d.getFullYear() !== Number(year)) return false;
  return true;
}

// Luon hien co dinh 5 nam gan nhat (nam hien tai va 4 nam truoc do), khong
// phu thuoc du lieu dang tai co hay khong - de nguoi dung luon chon duoc nam
// truoc do de tim, kho phai vi chua co ban ghi nao trong nam do ma dropdown
// bi thieu lua chon.
function settlementRecentYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => currentYear - i);
}

// 3 dropdown Ngay/Thang/Nam dung chung cho 1 moc thoi gian.
// minDay/minMonth/minYear (tuy chon): "moc toi thieu" - dung cho cac moc
// Ngay hoan thanh/Ngay xuat hoa don/Ngay huy vi ve logic chung KHONG THE som
// hon Ngay tiep nhan da chon o filter ben canh - an bot lua chon nam/thang/
// ngay som hon moc do de nguoi dung khong the lam ra 1 bo loc vo ly (khong
// bao gio co ket qua).
function DateDropdownFilter({ label, day, month, year, years, onDayChange, onMonthChange, onYearChange, minDay, minMonth, minYear }) {
  const yearOptions = minYear ? years.filter((y) => y >= Number(minYear)) : years;
  const sameYearAsMin = !!(minYear && year && Number(year) === Number(minYear));
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter((m) => !(sameYearAsMin && minMonth) || m >= Number(minMonth));
  const sameMonthAsMin = sameYearAsMin && !!(minMonth && month && Number(month) === Number(minMonth));
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1)
    .filter((d) => !(sameMonthAsMin && minDay) || d >= Number(minDay));

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label" style={{ fontSize: 11 }}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <select className="form-select" value={day} onChange={(e) => onDayChange(e.target.value)} style={{ minWidth: 80 }}>
          <option value="">Ngày</option>
          {dayOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select className="form-select" value={month} onChange={(e) => onMonthChange(e.target.value)} style={{ minWidth: 90 }}>
          <option value="">Tháng</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>Tháng {m}</option>
          ))}
        </select>
        <select className="form-select" value={year} onChange={(e) => onYearChange(e.target.value)} style={{ minWidth: 90 }}>
          <option value="">Năm</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function exportCsv(filename, header, rows) {
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang làm việc' },
  { value: 'inactive', label: 'Nghỉ việc' },
];

const STATUS_BADGE = {
  active: { label: 'Đang làm', className: 'badge-active' },
  inactive: { label: 'Nghỉ', className: 'badge-inactive' },
};

const AVATAR_COLORS = ['#2563EB', '#059669', '#D97706', '#DB2777', '#7C3AED', '#0891B2'];
const PAGE_SIZE = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0[0-9]{9,10}$/;
// Email nhan vien moi luon thuoc domain cong ty - chi cho nhap phan ten,
// duoi @autogara.com duoc tu dong gan vao khi tao moi.
const EMPLOYEE_EMAIL_DOMAIN = '@autogara.com';

function statusBadge(status) {
  return STATUS_BADGE[status] || { label: status || 'Không rõ', className: 'badge-inactive' };
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(id) {
  return AVATAR_COLORS[Number(id || 0) % AVATAR_COLORS.length];
}

function exportEmployeesCsv(employees) {
  const header = ['Mã NV', 'Họ và tên', 'Email', 'Vai trò', 'Chi nhánh', 'Số điện thoại', 'Ngày vào', 'Trạng thái'];
  const rows = employees.map((emp) => [
    emp.employeeId,
    emp.fullName,
    emp.email,
    emp.primaryRoleLabel,
    emp.branch?.name,
    emp.phone,
    formatDate(emp.createdAt),
    statusBadge(emp.status).label,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'danh-sach-nhan-vien.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function EmployeeAvatar({ employee }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: avatarColor(employee.id),
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {getInitials(employee.fullName)}
    </div>
  );
}

function EmployeeDetailModal({ employee, onClose }) {
  const [members, setMembers] = useState(null);
  const [specialties, setSpecialties] = useState(null);
  const [bays, setBays] = useState(null);
  const isTeamLeader = employee?.roles?.includes('team_leader');

  useEffect(() => {
    if (!employee?.id || !isTeamLeader) { setMembers(null); setSpecialties(null); setBays(null); return undefined; }
    let mounted = true;
    setMembers(null);
    setSpecialties(null);
    setBays(null);
    managerApi.getEmployeeById(employee.id)
      .then((data) => {
        if (!mounted) return;
        setMembers(data?.members || []);
        setSpecialties(data?.specialties || []);
        setBays(data?.bays || []);
      })
      .catch(() => { if (mounted) { setMembers([]); setSpecialties([]); setBays([]); } });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, isTeamLeader]);

  if (!employee) return null;
  const badge = statusBadge(employee.status);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Chi tiết nhân viên</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%', background: avatarColor(employee.id),
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700,
              }}
            >
              {getInitials(employee.fullName)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>{employee.fullName}</div>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
            </div>
          </div>
          <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div className="detail-row"><div className="detail-label">Mã NV</div><div className="detail-value">{employee.employeeId}</div></div>
            <div className="detail-row"><div className="detail-label">Email</div><div className="detail-value">{employee.email || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Số điện thoại</div><div className="detail-value">{employee.phone || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Vai trò</div><div className="detail-value">{employee.primaryRoleLabel || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Chi nhánh</div><div className="detail-value">{employee.branch?.name || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Ngày vào</div><div className="detail-value">{formatDate(employee.createdAt)}</div></div>
            <div className="detail-row"><div className="detail-label">Ghi chú</div><div className="detail-value">{employee.notes || '—'}</div></div>
          </div>

          {isTeamLeader && (
            <>
              <div style={{ fontWeight: 700, margin: '16px 0 8px', fontSize: 13, color: 'var(--gray-700)' }}>Chuyên môn</div>
              {specialties === null && <p className="form-hint">Đang tải…</p>}
              {specialties && specialties.length === 0 && <p className="form-hint">Chưa gán chuyên môn nào.</p>}
              {specialties && specialties.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  {specialties.map((s) => (
                    <span key={s.id} className="tag">{s.name}</span>
                  ))}
                </div>
              )}

              <div style={{ fontWeight: 700, margin: '16px 0 8px', fontSize: 13, color: 'var(--gray-700)' }}>
                Thợ máy đang quản lý ({(members || []).length})
              </div>
              {members === null && <p className="form-hint">Đang tải…</p>}
              {members && members.length === 0 && (
                <p className="form-hint">Chưa có thợ máy nào được gán cho tổ trưởng này.</p>
              )}
              {members && members.length > 0 && (
                <div className="table-wrapper" style={{ boxShadow: 'none' }}>
                  <table className="data-table">
                    <thead><tr><th>Mã NV</th><th>Thợ máy</th></tr></thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontFamily: 'monospace' }}>{m.employeeId}</td>
                          <td>{m.fullName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ fontWeight: 700, margin: '16px 0 8px', fontSize: 13, color: 'var(--gray-700)' }}>
                Khoang xe phụ trách ({(bays || []).length})
              </div>
              {bays === null && <p className="form-hint">Đang tải…</p>}
              {bays && bays.length === 0 && <p className="form-hint">Chưa phụ trách khoang xe nào.</p>}
              {bays && bays.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {bays.map((n) => <span key={n} className="tag">Khoang {n}</span>)}
                </div>
              )}
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

function EmployeeListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeEmployee, setActiveEmployee] = useState(null);
  const [page, setPage] = useState(1);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    let mounted = true;
    managerApi.getRoles().then((data) => { if (mounted) setRoles(data || []); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const reload = () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    managerApi
      .getEmployees({ search: search.trim(), role, status })
      .then((data) => {
        if (seq !== requestSeq.current) return;
        setEmployees(data || []);
        setPage(1);
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return;
        setEmployees([]);
        setError(err.message || 'Không tải được danh sách nhân viên');
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  };

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(reload, 300);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, status]);

  const clearFilters = () => {
    setSearch('');
    setRole('all');
    setStatus('all');
  };

  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  const pageItems = employees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Quản lý nhân viên</h1>
          <div className="breadcrumb">Trang chủ / Nhân viên</div>
        </div>
        <div className="page-header-right">
          <PermissionGate permission="screen:manager:employees:view">
            <button type="button" className="btn btn-secondary" onClick={() => exportEmployeesCsv(employees)}>
              📊 Xuất Excel
            </button>
          </PermissionGate>
          <PermissionGate permission="screen:manager:employees:create">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/manager/employees/create')}>
              + Thêm nhân viên
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <span className="search-icon">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã NV, tên, email..." />
        </div>

        <select className="filter-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">Tất cả vai trò</option>
          {roles.map((r) => (
            <option key={r.id} value={r.roleName}>{r.roleLabel}</option>
          ))}
        </select>

        <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {EMPLOYEE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button type="button" className="btn btn-secondary" onClick={clearFilters}>
          ✕ Xóa lọc
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>↻ Tải lại</button>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8, textAlign: 'right' }}>
        Hiển thị {pageItems.length}/{employees.length} nhân viên
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã NV</th>
              <th>Nhân viên</th>
              <th>Vai trò</th>
              <th>Số điện thoại</th>
              <th>Ngày vào</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">⏳</div>
                  <h3>Đang tải danh sách nhân viên</h3>
                </div>
              </td></tr>
            )}

            {!loading && pageItems.length === 0 && !error && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>Không có nhân viên phù hợp</h3>
                  <p>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
                </div>
              </td></tr>
            )}

            {!loading && pageItems.map((employee) => {
              const badge = statusBadge(employee.status);
              return (
                <tr key={employee.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{employee.employeeId}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <EmployeeAvatar employee={employee} />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{employee.fullName}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{employee.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{employee.primaryRoleLabel || '—'}</td>
                  <td>{employee.phone || '—'}</td>
                  <td>{formatDate(employee.createdAt)}</td>
                  <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                  <td>
                    <div className="table-actions">
                      <PermissionGate permission="screen:manager:employees:view">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Xem chi tiết" onClick={() => setActiveEmployee(employee)}>👁</button>
                      </PermissionGate>
                      <PermissionGate permission="screen:manager:employees:update">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Chỉnh sửa" onClick={() => navigate(`/manager/employees/${employee.id}/edit`)}>✏️</button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">
            {employees.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, employees.length)} trong {employees.length} kết quả
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>{page}</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>

      <EmployeeDetailModal employee={activeEmployee} onClose={() => setActiveEmployee(null)} />

      {!user?.branchId && (
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--red)' }}>
          Tài khoản của bạn chưa được gán chi nhánh, vui lòng liên hệ quản trị viên.
        </p>
      )}
    </div>
  );
}

function EmployeeFormPage({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === 'edit';
  const { can } = usePermission();
  const allowed = isEdit
    ? can('screen:manager:employees:update')
    : can('screen:manager:employees:create');

  const [branch, setBranch] = useState(null);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', roleId: '', status: 'active', password: '', confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Chi hien o che do sua: mac dinh khong doi mat khau, tich vao moi hien o
  // nhap mat khau moi - tranh bat buoc phai nhap lai moi lan chinh sua thong
  // tin khac cua nhan vien.
  const [changePassword, setChangePassword] = useState(false);

  // To truong quan ly 1 doi tho (users.team_leader_id) + phu trach vai khoang
  // xe (bang vehicle_bays) - chi co y nghia khi da co san mot to truong (che
  // do sua), vi API set 2 thu nay can id cua chinh to truong.
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSuggestions, setMemberSuggestions] = useState([]);
  const [bayNumbers, setBayNumbers] = useState([]);
  const [bayNumberInput, setBayNumberInput] = useState('');

  useEffect(() => {
    let mounted = true;
    managerApi.getBranch().then((data) => { if (mounted) setBranch(data); }).catch(() => {});
    managerApi.getRoles().then((data) => { if (mounted) setRoles(data || []); }).catch(() => {});

    if (isEdit && id) {
      managerApi
        .getEmployeeById(id)
        .then((data) => {
          if (!mounted || !data) return;
          setForm({
            fullName: data.fullName || '',
            email: data.email || '',
            phone: data.phone || '',
            roleId: data.primaryRoleId ? String(data.primaryRoleId) : '',
            status: data.status || 'active',
            password: '',
            confirmPassword: '',
          });
          setMembers(data.members || []);
          setBayNumbers(data.bays || []);
        })
        .catch((err) => { if (mounted) setError(err.message || 'Không tải được thông tin nhân viên'); })
        .finally(() => { if (mounted) setLoading(false); });
    }

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const selectedRole = roles.find((r) => String(r.id) === String(form.roleId));
  const isTeamLeaderRole = selectedRole?.roleName === 'team_leader';

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Go ten tim tho may de them vao doi - loc san nhung nguoi da co trong
  // danh sach members hien tai, khong can bam chon xong roi lai loc tay.
  useEffect(() => {
    if (!isEdit || !isTeamLeaderRole || !memberSearch.trim()) { setMemberSuggestions([]); return undefined; }
    let alive = true;
    const timer = setTimeout(() => {
      managerApi.getTechnicians({ search: memberSearch.trim(), status: 'active' })
        .then((data) => {
          if (!alive) return;
          const memberIds = new Set(members.map((m) => m.id));
          setMemberSuggestions((data || []).filter((t) => !memberIds.has(t.id)));
        })
        .catch(() => { if (alive) setMemberSuggestions([]); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [memberSearch, isEdit, isTeamLeaderRole, members]);

  const addMember = (technician) => {
    setMembers((prev) => (prev.some((m) => m.id === technician.id) ? prev : [...prev, { id: technician.id, employeeId: technician.employeeId, fullName: technician.fullName }]));
    setMemberSearch('');
    setMemberSuggestions([]);
  };

  const removeMember = (memberId) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const addBayNumber = () => {
    const n = Number(bayNumberInput);
    if (!Number.isInteger(n) || n <= 0) return;
    setBayNumbers((prev) => (prev.includes(n) ? prev : [...prev, n].sort((a, b) => a - b)));
    setBayNumberInput('');
  };

  const removeBayNumber = (n) => {
    setBayNumbers((prev) => prev.filter((x) => x !== n));
  };

  const validate = () => {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên';
    if (!form.email.trim()) errors.email = 'Vui lòng nhập email';
    else if (!EMAIL_REGEX.test(form.email.trim())) errors.email = 'Email không đúng định dạng';
    if (!form.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    else if (!PHONE_REGEX.test(form.phone.trim())) errors.phone = 'Số điện thoại không hợp lệ';
    if (!form.roleId) errors.roleId = 'Vui lòng chọn vai trò';
    if (!isEdit || changePassword) {
      if (!form.password) errors.password = 'Vui lòng nhập mật khẩu';
      else if (form.password.length < 8) errors.password = 'Mật khẩu tối thiểu 8 ký tự';
      if (form.confirmPassword !== form.password) errors.confirmPassword = 'Xác nhận mật khẩu không khớp';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validate()) return;
    // To truong luon phai phu trach it nhat 3 khoang de doi cua ho co du cho
    // hoat dong - trung voi rang buoc o BE (ManagerService.setBayNumbers).
    if (isEdit && isTeamLeaderRole && bayNumbers.length < 3) {
      setError('Mỗi tổ trưởng phải phụ trách tối thiểu 3 khoang xe.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        roleId: Number(form.roleId),
        status: form.status,
      };

      if (isEdit) {
        if (changePassword) {
          payload.password = form.password;
          payload.confirmPassword = form.confirmPassword;
        }
        await managerApi.updateEmployee(id, payload);
        if (isTeamLeaderRole) {
          await managerApi.setEmployeeTeamMembers(id, members.map((m) => m.id));
          await managerApi.setEmployeeBays(id, bayNumbers);
        }
        navigate('/manager/employees');
      } else {
        await managerApi.createEmployee({ ...payload, password: form.password, confirmPassword: form.confirmPassword });
        navigate('/manager/employees');
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  if (!allowed) {
    return <Navigate to="/manager/employees" replace />;
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏳</div>
        <h3>Đang tải thông tin nhân viên</h3>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{isEdit ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'}</h1>
          <div className="breadcrumb">Nhân viên / {isEdit ? 'Chỉnh sửa' : 'Thêm mới'}</div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="table-wrapper" style={{ padding: 20, marginBottom: 16 }}>
          <div className="form-section-title">👥 Thông tin nhân viên</div>

          {branch && (
            <div style={{ background: 'var(--primary-very-light)', border: '1px solid var(--primary-light)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--primary-dark)' }}>
              📍 Chi nhánh: <strong>{branch.name}</strong>
              {!isEdit && ' — Nhân viên mới sẽ được thêm vào chi nhánh này.'}
            </div>
          )}

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Họ và tên</label>
              <input className="form-input" value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} placeholder="Nhập họ và tên" />
              {fieldErrors.fullName && <span className="form-error">{fieldErrors.fullName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Email</label>
              {isEdit ? (
                <input className="form-input" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="email@autogara.com" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <input
                    className="form-input"
                    style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                    value={form.email.split('@')[0]}
                    onChange={(e) => {
                      const local = e.target.value.split('@')[0];
                      setField('email', local ? `${local}${EMPLOYEE_EMAIL_DOMAIN}` : '');
                    }}
                    placeholder="nguyenvana"
                  />
                  <span
                    style={{
                      display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 14, color: 'var(--gray-600, #4b5563)',
                      background: 'var(--gray-100, #f3f4f6)', border: '1px solid var(--gray-300, #d1d5db)', borderLeft: 'none',
                      borderTopRightRadius: 'var(--radius-sm, 6px)', borderBottomRightRadius: 'var(--radius-sm, 6px)', whiteSpace: 'nowrap',
                    }}
                  >
                    {EMPLOYEE_EMAIL_DOMAIN}
                  </span>
                </div>
              )}
              {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Số điện thoại</label>
              <input className="form-input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="0xxxxxxxxx" />
              {fieldErrors.phone && <span className="form-error">{fieldErrors.phone}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Vai trò</label>
              <select className="form-select" value={form.roleId} onChange={(e) => setField('roleId', e.target.value)}>
                <option value="">-- Chọn vai trò --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.roleLabel}</option>
                ))}
              </select>
              {fieldErrors.roleId && <span className="form-error">{fieldErrors.roleId}</span>}
            </div>

            {isEdit && (
              <div className="form-group">
                <label className="form-label required">Trạng thái</label>
                <select className="form-select" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  <option value="active">Đang làm việc</option>
                  <option value="inactive">Nghỉ việc</option>
                </select>
              </div>
            )}
          </div>


          {isTeamLeaderRole && isEdit && (
            <div className="form-group" style={{ marginTop: 14, position: 'relative' }}>
              <label className="form-label">Thành viên đội</label>
              <input
                className="form-input"
                placeholder="Gõ tên thợ máy để tìm và thêm..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
              {memberSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid var(--primary-light)', borderRadius: 6, boxShadow: 'var(--shadow-md)', maxHeight: 220, overflowY: 'auto' }}>
                  {memberSuggestions.map((t) => (
                    <div key={t.id} onMouseDown={() => addMember(t)}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--gray-100)' }}>
                      <b>{t.fullName}</b> <span style={{ color: 'var(--gray-500)' }}>({t.employeeId})</span>
                    </div>
                  ))}
                </div>
              )}
              {members.length === 0 ? (
                <p className="form-hint">Chưa có thợ máy nào trong đội.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {members.map((m) => (
                    <span key={m.id} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {m.fullName}
                      <button type="button" onClick={() => removeMember(m.id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--gray-500)', padding: 0 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {isTeamLeaderRole && isEdit && (
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Khoang xe phụ trách</label>
              <p className="form-hint" style={{ marginTop: 0 }}>Mỗi tổ trưởng phải phụ trách tối thiểu 3 khoang xe.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  style={{ maxWidth: 160 }}
                  type="number"
                  min={1}
                  placeholder="Số khoang"
                  value={bayNumberInput}
                  onChange={(e) => setBayNumberInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBayNumber(); } }}
                />
                <button type="button" className="btn btn-secondary" onClick={addBayNumber}>+ Thêm khoang</button>
              </div>
              {bayNumbers.length === 0 ? (
                <p className="form-hint">Chưa phụ trách khoang xe nào.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {bayNumbers.map((n) => (
                    <span key={n} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Khoang {n}
                      <button type="button" onClick={() => removeBayNumber(n)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--gray-500)', padding: 0 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isEdit && (
            <>
              <div className="form-section-title" style={{ marginTop: 24 }}>🔒 Thông tin đăng nhập</div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label required">Mật khẩu tạm thời</label>
                  <input type="password" className="form-input" value={form.password} onChange={(e) => setField('password', e.target.value)} placeholder="Tối thiểu 8 ký tự" />
                  {fieldErrors.password && <span className="form-error">{fieldErrors.password}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label required">Xác nhận mật khẩu</label>
                  <input type="password" className="form-input" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} placeholder="Nhập lại mật khẩu" />
                  {fieldErrors.confirmPassword && <span className="form-error">{fieldErrors.confirmPassword}</span>}
                </div>
              </div>
              <p className="form-hint" style={{ marginTop: 8 }}>Hãy gửi mật khẩu cho nhân viên qua kênh an toàn.</p>
            </>
          )}

          {isEdit && (
            <>
              <div className="form-section-title" style={{ marginTop: 24 }}>🔒 Mật khẩu</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={changePassword}
                  onChange={(e) => {
                    setChangePassword(e.target.checked);
                    if (!e.target.checked) {
                      setField('password', '');
                      setField('confirmPassword', '');
                    }
                  }}
                />
                <span>Đặt lại mật khẩu mới cho nhân viên này</span>
              </label>

              {changePassword && (
                <div className="form-grid form-grid-2" style={{ marginTop: 12 }}>
                  <div className="form-group">
                    <label className="form-label required">Mật khẩu mới</label>
                    <input type="password" className="form-input" value={form.password} onChange={(e) => setField('password', e.target.value)} placeholder="Tối thiểu 8 ký tự" autoFocus />
                    {fieldErrors.password && <span className="form-error">{fieldErrors.password}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Xác nhận mật khẩu mới</label>
                    <input type="password" className="form-input" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} placeholder="Nhập lại mật khẩu mới" />
                    {fieldErrors.confirmPassword && <span className="form-error">{fieldErrors.confirmPassword}</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/manager/employees')}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Đang lưu...' : isEdit ? '🔄 Cập nhật' : '+ Thêm nhân viên'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ServiceDetailModal({ service, onClose }) {
  const [parts, setParts] = useState(null);

  useEffect(() => {
    if (!service?.id) return undefined;
    let mounted = true;
    setParts(null);
    managerApi.getServiceById(service.id)
      .then((data) => { if (mounted) setParts(data?.parts || []); })
      .catch(() => { if (mounted) setParts([]); });
    return () => { mounted = false; };
  }, [service?.id]);

  if (!service) return null;
  const badge = activeBadge(service.isActive);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Chi tiết dịch vụ</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>{service.name}</div>
            <span className={`badge ${badge.className}`}>{badge.label}</span>
          </div>
          <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div className="detail-row"><div className="detail-label">Mã dịch vụ</div><div className="detail-value">{service.code}</div></div>
            <div className="detail-row"><div className="detail-label">Loại hình sửa chữa</div><div className="detail-value">{repairCategoryLabel(service.repairCategory)}</div></div>
            <div className="detail-row"><div className="detail-label">Đơn giá</div><div className="detail-value">{formatCurrency(service.unitPrice)}</div></div>
            <div className="detail-row"><div className="detail-label">Thời gian thực hiện</div><div className="detail-value">{service.durationMin ? `${service.durationMin} phút` : '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Mô tả</div><div className="detail-value">{service.description || '—'}</div></div>
          </div>

          <div className="form-section-title" style={{ marginTop: 16 }}>🔩 Phụ tùng cần thiết</div>
          {parts === null && <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Đang tải…</div>}
          {parts && parts.length === 0 && <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Chưa khai báo phụ tùng nào</div>}
          {parts && parts.length > 0 && (
            <div className="table-wrapper" style={{ boxShadow: 'none', marginTop: 8 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Mã</th><th>Tên phụ tùng</th><th>Đơn vị</th><th>Số lượng</th></tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.productId}>
                      <td style={{ fontFamily: 'monospace' }}>{p.productCode}</td>
                      <td>{p.productName}</td>
                      <td>{p.unitName || '—'}</td>
                      <td>{p.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function ServiceListPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [repairCategory, setRepairCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeService, setActiveService] = useState(null);
  const [page, setPage] = useState(1);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  const reload = () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    managerApi
      .getServices({ search: search.trim(), repairCategory, status })
      .then((data) => {
        if (seq !== requestSeq.current) return;
        setServices(data || []);
        setPage(1);
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return;
        setServices([]);
        setError(err.message || 'Không tải được danh sách dịch vụ');
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  };

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(reload, 300);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, repairCategory, status]);

  const clearFilters = () => {
    setSearch('');
    setRepairCategory('all');
    setStatus('all');
  };

  const totalPages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
  const pageItems = services.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Quản lý dịch vụ lẻ</h1>
          <div className="breadcrumb">Trang chủ / Dịch vụ lẻ</div>
        </div>
        <div className="page-header-right">
          <PermissionGate permission="screen:manager:services:view">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportCsv(
                'danh-sach-dich-vu.csv',
                ['Mã DV', 'Tên dịch vụ', 'Loại hình sửa chữa', 'Đơn giá', 'Thời gian (phút)', 'Trạng thái'],
                services.map((s) => [s.code, s.name, repairCategoryLabel(s.repairCategory), s.unitPrice, s.durationMin, activeBadge(s.isActive).label])
              )}
            >
              📊 Xuất Excel
            </button>
          </PermissionGate>
          <PermissionGate permission="screen:manager:services:create">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/manager/services/create')}>
              + Thêm dịch vụ
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <span className="search-icon">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã DV, tên dịch vụ..." />
        </div>

        <select className="filter-select" value={repairCategory} onChange={(e) => setRepairCategory(e.target.value)}>
          <option value="all">Tất cả loại hình sửa chữa</option>
          {REPAIR_CATEGORY_OPTIONS.filter((o) => o.value).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {SERVICE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button type="button" className="btn btn-secondary" onClick={clearFilters}>
          ✕ Xóa lọc
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>↻ Tải lại</button>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8, textAlign: 'right' }}>
        Hiển thị {pageItems.length}/{services.length} dịch vụ
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã DV</th>
              <th>Tên dịch vụ</th>
              <th>Loại hình sửa chữa</th>
              <th>Đơn giá</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">⏳</div>
                  <h3>Đang tải danh sách dịch vụ</h3>
                </div>
              </td></tr>
            )}

            {!loading && pageItems.length === 0 && !error && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>Không có dịch vụ phù hợp</h3>
                  <p>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc, hoặc thêm dịch vụ mới.</p>
                </div>
              </td></tr>
            )}

            {!loading && pageItems.map((service) => {
              const badge = activeBadge(service.isActive);
              return (
                <tr key={service.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{service.code}</td>
                  <td style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{service.name}</td>
                  <td>{repairCategoryLabel(service.repairCategory)}</td>
                  <td>{formatCurrency(service.unitPrice)}</td>
                  <td>{service.durationMin ? `${service.durationMin} phút` : '—'}</td>
                  <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                  <td>
                    <div className="table-actions">
                      <PermissionGate permission="screen:manager:services:view">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Xem chi tiết" onClick={() => setActiveService(service)}>👁</button>
                      </PermissionGate>
                      <PermissionGate permission="screen:manager:services:update">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Chỉnh sửa" onClick={() => navigate(`/manager/services/${service.id}/edit`)}>✏️</button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">
            {services.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, services.length)} trong {services.length} kết quả
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>{page}</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>

      <ServiceDetailModal service={activeService} onClose={() => setActiveService(null)} />
    </div>
  );
}

// Phai giu dong bo voi REPAIR_CATEGORY_OPTIONS trong RepairSettlementPage.jsx
// va REPAIR_CATEGORY_VALUES trong RepairSettlementService.js/ManagerService.js -
// khai bao san Loai hinh sua chua o day de man tao phieu quyet toan tu dong
// dien theo dung dich vu/goi da chon, khong phai chon tay tung lan.
const REPAIR_CATEGORY_OPTIONS = [
  { value: '', label: '' },
  { value: 'ER', label: 'Sửa chữa động cơ' },
  { value: 'CB', label: 'Sửa chữa gầm' },
  { value: 'EE', label: 'Sửa chữa điện - điện tử' },
  { value: 'BP', label: 'Đồng sơn' },
  { value: 'PM', label: 'Bảo dưỡng định kỳ' },
];

function repairCategoryLabel(code) {
  return REPAIR_CATEGORY_OPTIONS.find((o) => o.value === code)?.label || '—';
}

function ServiceFormPage({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === 'edit';
  const { can } = usePermission();
  const allowed = isEdit
    ? can('screen:manager:services:update')
    : can('screen:manager:services:create');

  const [branch, setBranch] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    serviceName: '', unitPrice: '', durationMin: '', description: '', isActive: true, repairCategory: '',
  });
  const [parts, setParts] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [packageWarning, setPackageWarning] = useState(null);

  useEffect(() => {
    let mounted = true;
    managerApi.getBranch().then((data) => { if (mounted) setBranch(data); }).catch(() => {});
    managerApi.getProducts().then((data) => { if (mounted) setProducts(data || []); }).catch(() => {});

    if (isEdit && id) {
      managerApi
        .getServiceById(id)
        .then((data) => {
          if (!mounted || !data) return;
          setForm({
            serviceName: data.name || '',
            unitPrice: data.unitPrice ?? '',
            durationMin: data.durationMin ?? '',
            description: data.description || '',
            isActive: data.isActive,
            repairCategory: data.repairCategory || '',
          });
          setParts((data.parts || []).map((p) => ({ productId: String(p.productId), quantity: p.quantity })));
        })
        .catch((err) => { if (mounted) setError(err.message || 'Không tải được thông tin dịch vụ'); })
        .finally(() => { if (mounted) setLoading(false); });
    }

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const addPartRow = () => setParts((prev) => [...prev, { productId: '', quantity: 1 }]);
  const removePartRow = (idx) => setParts((prev) => prev.filter((_, i) => i !== idx));
  const setPartField = (idx, key, value) => {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!form.serviceName.trim()) errors.serviceName = 'Vui lòng nhập tên dịch vụ';
    if (form.unitPrice === '' || Number.isNaN(Number(form.unitPrice)) || Number(form.unitPrice) < 0) {
      errors.unitPrice = 'Đơn giá không hợp lệ';
    }
    if (form.durationMin !== '' && (Number.isNaN(Number(form.durationMin)) || Number(form.durationMin) < 0)) {
      errors.durationMin = 'Thời gian không hợp lệ';
    }
    const filledParts = parts.filter((p) => p.productId !== '');
    if (filledParts.some((p) => !p.quantity || Number(p.quantity) <= 0)) {
      errors.parts = 'Số lượng phụ tùng phải lớn hơn 0';
    }
    const productIds = filledParts.map((p) => p.productId);
    if (new Set(productIds).size !== productIds.length) {
      errors.parts = 'Không được chọn trùng 1 phụ tùng nhiều lần';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        serviceName: form.serviceName.trim(),
        unitPrice: Number(form.unitPrice),
        durationMin: form.durationMin === '' ? null : Number(form.durationMin),
        description: form.description.trim(),
        isActive: form.isActive,
        repairCategory: form.repairCategory || null,
        parts: parts
          .filter((p) => p.productId !== '')
          .map((p) => ({ productId: Number(p.productId), quantity: Number(p.quantity) })),
      };

      let result;
      if (isEdit) {
        result = await managerApi.updateService(id, payload);
      } else {
        result = await managerApi.createService(payload);
      }

      if (isEdit && result?.usedInPackages?.length > 0) {
        setPackageWarning(result.usedInPackages);
      } else {
        navigate('/manager/services');
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  if (!allowed) {
    return <Navigate to="/manager/services" replace />;
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏳</div>
        <h3>Đang tải thông tin dịch vụ</h3>
      </div>
    );
  }

  if (packageWarning) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-left">
            <h1>Chỉnh sửa dịch vụ</h1>
            <div className="breadcrumb">Dịch vụ lẻ / Chỉnh sửa</div>
          </div>
        </div>
        <div style={{ background: '#FFF3E0', border: '1px solid #FFD9A0', color: '#B45309', borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠️ Dịch vụ đã được ngừng áp dụng</div>
          <p style={{ marginBottom: 10 }}>
            Dịch vụ này vẫn đang nằm trong {packageWarning.length} gói dịch vụ đang hoạt động. Các gói đó sẽ
            KHÔNG tự động cập nhật — nếu muốn, hãy vào từng gói để bỏ dịch vụ này ra:
          </p>
          <ul style={{ margin: '0 0 14px 20px' }}>
            {packageWarning.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ margin: '4px 0' }}
                  onClick={() => navigate(`/manager/service-packages/${p.id}/edit`)}
                >
                  {p.code} — {p.name}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/manager/services')}>
            Đã hiểu, quay lại danh sách dịch vụ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{isEdit ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ'}</h1>
          <div className="breadcrumb">Dịch vụ lẻ / {isEdit ? 'Chỉnh sửa' : 'Thêm mới'}</div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="table-wrapper" style={{ padding: 20, marginBottom: 16 }}>
          <div className="form-section-title">🛠️ Thông tin dịch vụ</div>

          {branch && (
            <div style={{ background: 'var(--primary-very-light)', border: '1px solid var(--primary-light)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--primary-dark)' }}>
              📍 Chi nhánh: <strong>{branch.name}</strong>
              {!isEdit && ' — Dịch vụ mới sẽ được thêm vào danh mục chi nhánh này.'}
            </div>
          )}

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Tên dịch vụ</label>
              <input className="form-input" value={form.serviceName} onChange={(e) => setField('serviceName', e.target.value)} placeholder="Nhập tên dịch vụ" />
              {fieldErrors.serviceName && <span className="form-error">{fieldErrors.serviceName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Đơn giá (VND)</label>
              <input type="number" min="0" className="form-input" value={form.unitPrice} onChange={(e) => setField('unitPrice', e.target.value)} placeholder="0" />
              {fieldErrors.unitPrice && <span className="form-error">{fieldErrors.unitPrice}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Thời gian thực hiện (phút)</label>
              <input type="number" min="0" className="form-input" value={form.durationMin} onChange={(e) => setField('durationMin', e.target.value)} placeholder="Ví dụ: 30" />
              {fieldErrors.durationMin && <span className="form-error">{fieldErrors.durationMin}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Loại hình sửa chữa</label>
              <select className="form-select" value={form.repairCategory} onChange={(e) => setField('repairCategory', e.target.value)}>
                {REPAIR_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                Dùng để tự điền khi cố vấn dịch vụ chọn dịch vụ này trên phiếu quyết toán.
              </div>
            </div>

            {isEdit && (
              <div className="form-group">
                <label className="form-label required">Trạng thái</label>
                <select className="form-select" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => setField('isActive', e.target.value === 'active')}>
                  <option value="active">Đang áp dụng</option>
                  <option value="inactive">Ngừng áp dụng</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Mô tả</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Mô tả ngắn về dịch vụ" />
          </div>
        </div>

        <div className="table-wrapper" style={{ padding: 20, marginBottom: 16 }}>
          <div className="form-section-title">🔩 Phụ tùng cần thiết</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>
            Khai báo phụ tùng và số lượng cần dùng để hoàn thành dịch vụ này (không bắt buộc).
          </div>

          {parts.length === 0 && (
            <div style={{ color: 'var(--gray-400)', fontSize: 13, marginBottom: 10 }}>Chưa có phụ tùng nào</div>
          )}

          {parts.map((part, idx) => {
            const selectedElsewhere = parts.filter((_, i) => i !== idx).map((p) => p.productId);
            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 40px', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                <select className="form-select" value={part.productId} onChange={(e) => setPartField(idx, 'productId', e.target.value)}>
                  <option value="">-- Chọn phụ tùng --</option>
                  {products
                    .filter((p) => !selectedElsewhere.includes(String(p.id)))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name} ({p.unitName || '—'})</option>
                    ))}
                </select>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={part.quantity}
                  onChange={(e) => setPartField(idx, 'quantity', e.target.value)}
                  placeholder="SL"
                />
                <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => removePartRow(idx)}>✕</button>
              </div>
            );
          })}

          {fieldErrors.parts && <span className="form-error">{fieldErrors.parts}</span>}

          <button type="button" className="btn btn-secondary btn-sm" onClick={addPartRow} style={{ marginTop: 6 }}>
            + Thêm phụ tùng
          </button>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/manager/services')}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Đang lưu...' : isEdit ? '🔄 Cập nhật' : '+ Thêm dịch vụ'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ServicePackageDetailModal({ pkg, onClose }) {
  if (!pkg) return null;
  const badge = activeBadge(pkg.isActive);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Chi tiết gói dịch vụ</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>{pkg.name}</div>
            <span className={`badge ${badge.className}`}>{badge.label}</span>
          </div>
          <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16 }}>
            <div className="detail-row"><div className="detail-label">Mã gói</div><div className="detail-value">{pkg.code}</div></div>
            <div className="detail-row"><div className="detail-label">Loại hình sửa chữa</div><div className="detail-value">{repairCategoryLabel(pkg.repairCategory)}</div></div>
            <div className="detail-row"><div className="detail-label">Giá gói</div><div className="detail-value">{formatCurrency(pkg.totalPrice)}</div></div>
            <div className="detail-row"><div className="detail-label">Mô tả</div><div className="detail-value">{pkg.description || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Giải thích chi tiết</div><div className="detail-value">{pkg.purpose || '—'}</div></div>
          </div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, color: 'var(--gray-700)' }}>
            Dịch vụ trong gói ({(pkg.services || []).length})
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Mã DV</th><th>Tên dịch vụ</th><th>Đơn giá</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {(pkg.services || []).map((s) => {
                  const svcBadge = activeBadge(s.isActive);
                  return (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace' }}>{s.code}</td>
                      <td>{s.name}</td>
                      <td>{formatCurrency(s.unitPrice)}</td>
                      <td><span className={`badge ${svcBadge.className}`}>{svcBadge.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function ServicePackageListPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [search, setSearch] = useState('');
  const [repairCategory, setRepairCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePackage, setActivePackage] = useState(null);
  const [activePackageLoading, setActivePackageLoading] = useState(false);
  const [page, setPage] = useState(1);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  const reload = () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    managerApi
      .getServicePackages({ search: search.trim(), repairCategory, status })
      .then((data) => {
        if (seq !== requestSeq.current) return;
        setPackages(data || []);
        setPage(1);
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return;
        setPackages([]);
        setError(err.message || 'Không tải được danh sách gói dịch vụ');
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  };

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(reload, 300);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, repairCategory, status]);

  const clearFilters = () => {
    setSearch('');
    setRepairCategory('all');
    setStatus('all');
  };

  const openDetail = (pkg) => {
    setActivePackage(pkg);
    setActivePackageLoading(true);
    managerApi
      .getServicePackageById(pkg.id)
      .then((data) => setActivePackage(data || pkg))
      .finally(() => setActivePackageLoading(false));
  };

  const totalPages = Math.max(1, Math.ceil(packages.length / PAGE_SIZE));
  const pageItems = packages.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Quản lý gói dịch vụ</h1>
          <div className="breadcrumb">Trang chủ / Gói dịch vụ</div>
        </div>
        <div className="page-header-right">
          <PermissionGate permission="screen:manager:services:view">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportCsv(
                'danh-sach-goi-dich-vu.csv',
                ['Mã gói', 'Tên gói', 'Loại hình sửa chữa', 'Số dịch vụ', 'Giá gói', 'Trạng thái'],
                packages.map((p) => [p.code, p.name, repairCategoryLabel(p.repairCategory), p.itemCount, p.totalPrice, activeBadge(p.isActive).label])
              )}
            >
              📊 Xuất Excel
            </button>
          </PermissionGate>
          <PermissionGate permission="screen:manager:services:create">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/manager/service-packages/create')}>
              + Thêm gói dịch vụ
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <span className="search-icon">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã gói, tên gói..." />
        </div>

        <select className="filter-select" value={repairCategory} onChange={(e) => setRepairCategory(e.target.value)}>
          <option value="all">Tất cả loại hình sửa chữa</option>
          {REPAIR_CATEGORY_OPTIONS.filter((o) => o.value).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {SERVICE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button type="button" className="btn btn-secondary" onClick={clearFilters}>
          ✕ Xóa lọc
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>↻ Tải lại</button>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8, textAlign: 'right' }}>
        Hiển thị {pageItems.length}/{packages.length} gói dịch vụ
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã gói</th>
              <th>Tên gói</th>
              <th>Loại hình sửa chữa</th>
              <th>Số dịch vụ</th>
              <th>Giá gói</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">⏳</div>
                  <h3>Đang tải danh sách gói dịch vụ</h3>
                </div>
              </td></tr>
            )}

            {!loading && pageItems.length === 0 && !error && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>Không có gói dịch vụ phù hợp</h3>
                  <p>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc, hoặc thêm gói mới.</p>
                </div>
              </td></tr>
            )}

            {!loading && pageItems.map((pkg) => {
              const badge = activeBadge(pkg.isActive);
              return (
                <tr key={pkg.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{pkg.code}</td>
                  <td style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{pkg.name}</td>
                  <td>{repairCategoryLabel(pkg.repairCategory)}</td>
                  <td>{pkg.itemCount}</td>
                  <td>{formatCurrency(pkg.totalPrice)}</td>
                  <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                  <td>
                    <div className="table-actions">
                      <PermissionGate permission="screen:manager:services:view">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Xem chi tiết" onClick={() => openDetail(pkg)}>👁</button>
                      </PermissionGate>
                      <PermissionGate permission="screen:manager:services:update">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Chỉnh sửa" onClick={() => navigate(`/manager/service-packages/${pkg.id}/edit`)}>✏️</button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">
            {packages.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, packages.length)} trong {packages.length} kết quả
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>{page}</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {!activePackageLoading && <ServicePackageDetailModal pkg={activePackage} onClose={() => setActivePackage(null)} />}
    </div>
  );
}

function ServicePackageFormPage({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === 'edit';
  const { can } = usePermission();
  const allowed = isEdit
    ? can('screen:manager:services:update')
    : can('screen:manager:services:create');

  const [branch, setBranch] = useState(null);
  const [availableServices, setAvailableServices] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [form, setForm] = useState({
    packageName: '', totalPrice: '', description: '', purpose: '', isActive: true, repairCategory: '', serviceIds: [],
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    managerApi.getBranch().then((data) => { if (mounted) setBranch(data); }).catch(() => {});
    managerApi.getServices({ status: 'all' }).then((data) => { if (mounted) setAvailableServices(data || []); }).catch(() => {});

    if (isEdit && id) {
      managerApi
        .getServicePackageById(id)
        .then((data) => {
          if (!mounted || !data) return;
          setForm({
            packageName: data.name || '',
            totalPrice: data.totalPrice ?? '',
            description: data.description || '',
            purpose: data.purpose || '',
            isActive: data.isActive,
            repairCategory: data.repairCategory || '',
            serviceIds: (data.services || []).map((s) => s.id),
          });
        })
        .catch((err) => { if (mounted) setError(err.message || 'Không tải được thông tin gói dịch vụ'); })
        .finally(() => { if (mounted) setLoading(false); });
    }

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const toggleService = (serviceId) => {
    setForm((prev) => {
      const exists = prev.serviceIds.includes(serviceId);
      return {
        ...prev,
        serviceIds: exists ? prev.serviceIds.filter((sid) => sid !== serviceId) : [...prev.serviceIds, serviceId],
      };
    });
    setFieldErrors((prev) => ({ ...prev, serviceIds: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!form.packageName.trim()) errors.packageName = 'Vui lòng nhập tên gói';
    if (form.totalPrice === '' || Number.isNaN(Number(form.totalPrice)) || Number(form.totalPrice) < 0) {
      errors.totalPrice = 'Giá gói không hợp lệ';
    }
    if (form.serviceIds.length === 0) errors.serviceIds = 'Vui lòng chọn ít nhất 1 dịch vụ cho gói';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        packageName: form.packageName.trim(),
        totalPrice: Number(form.totalPrice),
        description: form.description.trim(),
        purpose: form.purpose.trim(),
        isActive: form.isActive,
        repairCategory: form.repairCategory || null,
        serviceIds: form.serviceIds,
      };

      if (isEdit) {
        await managerApi.updateServicePackage(id, payload);
      } else {
        await managerApi.createServicePackage(payload);
      }
      navigate('/manager/service-packages');
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  if (!allowed) {
    return <Navigate to="/manager/service-packages" replace />;
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏳</div>
        <h3>Đang tải thông tin gói dịch vụ</h3>
      </div>
    );
  }

  const selectedTotal = availableServices
    .filter((s) => form.serviceIds.includes(s.id))
    .reduce((sum, s) => sum + Number(s.unitPrice || 0), 0);

  const needle = serviceSearch.trim().toLowerCase();
  const filteredServices = needle
    ? availableServices.filter(
        (s) => s.name.toLowerCase().includes(needle) || s.code.toLowerCase().includes(needle)
      )
    : availableServices;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{isEdit ? 'Chỉnh sửa gói dịch vụ' : 'Thêm gói dịch vụ'}</h1>
          <div className="breadcrumb">Gói dịch vụ / {isEdit ? 'Chỉnh sửa' : 'Thêm mới'}</div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="table-wrapper" style={{ padding: 20, marginBottom: 16 }}>
          <div className="form-section-title">📦 Thông tin gói dịch vụ</div>

          {branch && (
            <div style={{ background: 'var(--primary-very-light)', border: '1px solid var(--primary-light)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--primary-dark)' }}>
              📍 Chi nhánh: <strong>{branch.name}</strong>
              {!isEdit && ' — Gói dịch vụ mới sẽ được thêm vào danh mục chi nhánh này.'}
            </div>
          )}

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Tên gói dịch vụ</label>
              <input className="form-input" value={form.packageName} onChange={(e) => setField('packageName', e.target.value)} placeholder="Nhập tên gói dịch vụ" />
              {fieldErrors.packageName && <span className="form-error">{fieldErrors.packageName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Giá gói (VND)</label>
              <input type="number" min="0" className="form-input" value={form.totalPrice} onChange={(e) => setField('totalPrice', e.target.value)} placeholder="0" />
              {fieldErrors.totalPrice && <span className="form-error">{fieldErrors.totalPrice}</span>}
              {form.serviceIds.length > 0 && (
                <span className="form-hint">Tổng giá các dịch vụ đã chọn: {formatCurrency(selectedTotal)}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Loại hình sửa chữa</label>
              <select className="form-select" value={form.repairCategory} onChange={(e) => setField('repairCategory', e.target.value)}>
                {REPAIR_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                Dùng để tự điền khi cố vấn dịch vụ chọn gói này trên phiếu quyết toán.
              </div>
            </div>

            {isEdit && (
              <div className="form-group">
                <label className="form-label required">Trạng thái</label>
                <select className="form-select" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => setField('isActive', e.target.value === 'active')}>
                  <option value="active">Đang áp dụng</option>
                  <option value="inactive">Ngừng áp dụng</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Mô tả</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Mô tả ngắn về gói dịch vụ" />
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Giải thích chi tiết (hiển thị ở trang chi tiết gói trên landing page)</label>
            <textarea
              className="form-textarea"
              rows={5}
              value={form.purpose}
              onChange={(e) => setField('purpose', e.target.value)}
              placeholder="Gói này dùng để làm gì, khi nào nên thực hiện, vì sao cần thiết..."
            />
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label required">
              Dịch vụ trong gói {form.serviceIds.length > 0 && `(đã chọn ${form.serviceIds.length})`}
            </label>
            {availableServices.length === 0 ? (
              <p className="form-hint">Chi nhánh chưa có dịch vụ lẻ nào đang áp dụng — hãy thêm Dịch vụ lẻ trước.</p>
            ) : (
              <>
                <div className="search-input" style={{ maxWidth: '100%', marginBottom: 8 }}>
                  <span className="search-icon">🔍</span>
                  <input
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Tìm dịch vụ theo tên hoặc mã..."
                  />
                </div>
                <div style={{ border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', maxHeight: 260, overflowY: 'auto' }}>
                  {filteredServices.length === 0 ? (
                    <p style={{ padding: 12, fontSize: 13, color: 'var(--gray-500)' }}>Không tìm thấy dịch vụ phù hợp.</p>
                  ) : (
                    filteredServices.map((s) => (
                      <label
                        key={s.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--gray-100)', fontSize: 13, cursor: 'pointer', opacity: s.isActive ? 1 : 0.65 }}
                      >
                        <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
                        <span style={{ flex: 1 }}>{s.name}</span>
                        {!s.isActive && <span className="badge badge-inactive">Ngừng áp dụng</span>}
                        <span style={{ color: 'var(--gray-500)' }}>{formatCurrency(s.unitPrice)}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
            {fieldErrors.serviceIds && <span className="form-error">{fieldErrors.serviceIds}</span>}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/manager/service-packages')}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Đang lưu...' : isEdit ? '🔄 Cập nhật' : '+ Thêm gói dịch vụ'}
          </button>
        </div>
      </form>
    </div>
  );
}


function SettlementReportsPage() {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('waiting_repair');
  const [intakeDay, setIntakeDay] = useState('');
  const [intakeMonth, setIntakeMonth] = useState('');
  const [intakeYear, setIntakeYear] = useState('');
  const [secondaryDay, setSecondaryDay] = useState('');
  const [secondaryMonth, setSecondaryMonth] = useState('');
  const [secondaryYear, setSecondaryYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);
  const secondaryDateField = SETTLEMENT_SECONDARY_DATE_FIELD_BY_TAB[activeTab] || null;

  const reload = () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    managerApi
      .getSettlementReports({ search: search.trim() })
      .then((data) => {
        if (seq !== requestSeq.current) return;
        setReports(data || []);
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return;
        setReports([]);
        setError(err.message || 'Không tải được danh sách phiếu quyết toán');
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  };

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(reload, 300);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setIntakeDay(''); setIntakeMonth(''); setIntakeYear('');
    setSecondaryDay(''); setSecondaryMonth(''); setSecondaryYear('');
  }, [activeTab]);

  // Doi lai "Ngay tiep nhan" thi bo chon moc con lai (Ngay hoan thanh/Ngay
  // xuat hoa don/Ngay huy) luon - vi khoang cho phep chon cua no thay doi
  // theo, giu nguyen lua chon cu de tranh ket qua "trong qua khu" khong
  // hop le.
  useEffect(() => {
    setSecondaryDay(''); setSecondaryMonth(''); setSecondaryYear('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeDay, intakeMonth, intakeYear]);

  const counts = reports.reduce(
    (acc, r) => {
      acc.all += 1;
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { all: 0 }
  );

  const dateFilterYears = settlementRecentYears();
  // Chi con loc theo ngay o 2 tab "ket qua cuoi cung" (Da xuat hoa don / Da
  // huy) - 3 tab con lai (Cho sua chua/Dang sua chua/Cho thanh toan) la trang
  // thai dang xu ly, khong can bo loc ngay nua.
  const showDateFilter = activeTab === 'invoiced' || activeTab === 'cancelled';

  const filteredReports = reports.filter((r) => {
    if (r.status !== activeTab) return false;
    if (showDateFilter) {
      if (!settlementDateMatches(r.intakeDate, intakeDay, intakeMonth, intakeYear)) return false;
      if (secondaryDateField && !settlementDateMatches(r[secondaryDateField.key], secondaryDay, secondaryMonth, secondaryYear)) return false;
    }
    return true;
  });

  const openDetail = (report) => {
    setActiveReport(report);
    setDetailError('');
    setDetailLoading(true);
    managerApi
      .getSettlementReportById(report.id)
      .then((data) => setActiveReport(data || report))
      .catch((err) => setDetailError(err.message || 'Không tải được chi tiết phiếu quyết toán'))
      .finally(() => setDetailLoading(false));
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Quyết toán sửa chữa</h1>
          <div className="breadcrumb">Trang chủ / Quyết toán sửa chữa</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input" style={{ maxWidth: 420 }}>
          <span className="search-icon">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã phiếu, biển số, khách hàng, số điện thoại..."
          />
        </div>
      </div>

      <div className="tabs">
        {SETTLEMENT_STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`tab-btn ${activeTab === tab.value ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label} ({counts[tab.value] || 0})
          </button>
        ))}
      </div>

      {showDateFilter && (
        <div className="filter-bar" style={{ marginTop: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <DateDropdownFilter
            label="Ngày tiếp nhận"
            day={intakeDay} month={intakeMonth} year={intakeYear}
            years={dateFilterYears}
            onDayChange={setIntakeDay} onMonthChange={setIntakeMonth} onYearChange={setIntakeYear}
          />

          {secondaryDateField && (
            <DateDropdownFilter
              label={secondaryDateField.label}
              day={secondaryDay} month={secondaryMonth} year={secondaryYear}
              years={dateFilterYears}
              onDayChange={setSecondaryDay} onMonthChange={setSecondaryMonth} onYearChange={setSecondaryYear}
              minDay={intakeDay} minMonth={intakeMonth} minYear={intakeYear}
            />
          )}

          {(intakeDay || intakeMonth || intakeYear || secondaryDay || secondaryMonth || secondaryYear) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setIntakeDay(''); setIntakeMonth(''); setIntakeYear('');
                setSecondaryDay(''); setSecondaryMonth(''); setSecondaryYear('');
              }}
            >
              ✕ Xóa lọc ngày
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>↻ Tải lại</button>
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Xe</th>
              <th>Khách hàng</th>
              <th>Tư vấn</th>
              <th>Tiếp nhận</th>
              {activeTab !== 'cancelled' && <th>Hoàn thành</th>}
              <th>Chi phí</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={activeTab === 'cancelled' ? 8 : 9}>
                <div className="empty-state">
                  <div className="empty-state-icon">⏳</div>
                  <h3>Đang tải danh sách phiếu quyết toán</h3>
                </div>
              </td></tr>
            )}

            {!loading && filteredReports.length === 0 && !error && (
              <tr><td colSpan={activeTab === 'cancelled' ? 8 : 9}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>Không có phiếu quyết toán phù hợp</h3>
                  <p>Thử thay đổi từ khóa tìm kiếm hoặc chọn trạng thái khác.</p>
                </div>
              </td></tr>
            )}

            {!loading && filteredReports.map((report) => {
              const badge = settlementStatusBadge(report.status);
              return (
                <tr key={report.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary-dark)' }}>{report.code}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{report.vehicle?.licensePlate || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      {report.vehicle?.vehicleModel || '—'}{report.vehicle?.manufactureYear ? ` · ${report.vehicle.manufactureYear}` : ''}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{report.customer?.fullName || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{report.customer?.phone || '—'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{report.advisor?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{report.advisor?.phone || ''}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{formatDate(report.intakeDate)}</td>
                  {activeTab !== 'cancelled' && <td style={{ fontSize: 12 }}>{formatDate(report.completedDate)}</td>}
                  <td style={{ fontWeight: 800, color: '#C62828' }}>{formatCurrency(report.total)}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: badge.background, color: badge.color, fontSize: 12, fontWeight: 800 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-info btn-sm" onClick={() => openDetail(report)}>Xem chi tiết</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">{filteredReports.length} phiếu</span>
        </div>
      </div>

      {detailError && (
        <div style={{ marginTop: 12, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', borderRadius: 10, padding: '12px 14px' }}>
          {detailError}
        </div>
      )}

      {detailLoading && (
        <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', borderRadius: 10, padding: '12px 14px' }}>
          Đang tải chi tiết phiếu quyết toán...
        </div>
      )}

      {!detailLoading && activeReport && <SettlementDetailModal report={activeReport} onClose={() => setActiveReport(null)} />}
    </div>
  );
}

function TechnicianDetailModal({ technician, onClose }) {
  if (!technician) return null;
  const badge = statusBadge(technician.status);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Chi tiết thợ máy</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <EmployeeAvatar employee={technician} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>{technician.fullName}</div>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
            </div>
          </div>
          <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16 }}>
            <div className="detail-row"><div className="detail-label">Mã NV</div><div className="detail-value">{technician.employeeId}</div></div>
            <div className="detail-row"><div className="detail-label">Email</div><div className="detail-value">{technician.email || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Số điện thoại</div><div className="detail-value">{technician.phone || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Tổ trưởng</div><div className="detail-value">{technician.teamLeaderName || 'Chưa gán'}</div></div>
            <div className="detail-row"><div className="detail-label">Chi nhánh</div><div className="detail-value">{technician.branch?.name || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Ngày vào</div><div className="detail-value">{formatDate(technician.createdAt)}</div></div>
          </div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13, color: 'var(--gray-700)' }}>Chuyên môn</div>
          {(technician.specialties || []).length === 0 ? (
            <p className="form-hint">Chưa gán chuyên môn nào.</p>
          ) : (
            <div>
              {technician.specialties.map((s) => (
                <span key={s.id} className="tag">{s.name}</span>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function TechnicianListPage() {
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState([]);
  const [teamLeaderOptions, setTeamLeaderOptions] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [teamLeaderId, setTeamLeaderId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTechnician, setActiveTechnician] = useState(null);
  const [page, setPage] = useState(1);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    let mounted = true;
    managerApi.getTeamLeaderOptions().then((data) => { if (mounted) setTeamLeaderOptions(data || []); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const reload = () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    managerApi
      .getTechnicians({ search: search.trim(), status, teamLeaderId })
      .then((data) => {
        if (seq !== requestSeq.current) return;
        setTechnicians(data || []);
        setPage(1);
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return;
        setTechnicians([]);
        setError(err.message || 'Không tải được danh sách thợ máy');
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  };

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(reload, 300);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, teamLeaderId]);

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setTeamLeaderId('all');
  };

  const totalPages = Math.max(1, Math.ceil(technicians.length / PAGE_SIZE));
  const pageItems = technicians.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Quản lý thợ máy</h1>
          <div className="breadcrumb">Trang chủ / Thợ máy</div>
        </div>
        <div className="page-header-right">
          <PermissionGate permission="screen:manager:technicians:view">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportCsv(
                'danh-sach-tho-may.csv',
                ['Mã NV', 'Họ và tên', 'Email', 'Tổ trưởng', 'Số điện thoại', 'Ngày vào', 'Trạng thái'],
                technicians.map((t) => [
                  t.employeeId, t.fullName, t.email, t.teamLeaderName,
                  t.phone, formatDate(t.createdAt), statusBadge(t.status).label,
                ])
              )}
            >
              📊 Xuất Excel
            </button>
          </PermissionGate>
          <PermissionGate permission="screen:manager:technicians:create">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/manager/technicians/create')}>
              + Thêm thợ máy
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <span className="search-icon">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã NV, tên, email..." />
        </div>

        <select className="filter-select" value={teamLeaderId} onChange={(e) => setTeamLeaderId(e.target.value)}>
          <option value="all">Tất cả tổ trưởng</option>
          {teamLeaderOptions.map((tl) => (
            <option key={tl.id} value={tl.id}>{tl.fullName}</option>
          ))}
        </select>

        <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {EMPLOYEE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button type="button" className="btn btn-secondary" onClick={clearFilters}>
          ✕ Xóa lọc
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>↻ Tải lại</button>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8, textAlign: 'right' }}>
        Hiển thị {pageItems.length}/{technicians.length} thợ máy
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã NV</th>
              <th>Thợ máy</th>
              <th>Tổ trưởng</th>
              <th>Số điện thoại</th>
              <th>Ngày vào</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">⏳</div>
                  <h3>Đang tải danh sách thợ máy</h3>
                </div>
              </td></tr>
            )}

            {!loading && pageItems.length === 0 && !error && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3>Không có thợ máy phù hợp</h3>
                  <p>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc, hoặc thêm thợ máy mới.</p>
                </div>
              </td></tr>
            )}

            {!loading && pageItems.map((technician) => {
              const badge = statusBadge(technician.status);
              return (
                <tr key={technician.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)' }}>{technician.employeeId}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <EmployeeAvatar employee={technician} />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{technician.fullName}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{technician.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{technician.teamLeaderName || 'Chưa gán'}</td>
                  <td>{technician.phone || '—'}</td>
                  <td>{formatDate(technician.createdAt)}</td>
                  <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                  <td>
                    <div className="table-actions">
                      <PermissionGate permission="screen:manager:technicians:view">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Xem chi tiết" onClick={() => setActiveTechnician(technician)}>👁</button>
                      </PermissionGate>
                      <PermissionGate permission="screen:manager:technicians:update">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Chỉnh sửa" onClick={() => navigate(`/manager/technicians/${technician.id}/edit`)}>✏️</button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">
            {technicians.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, technicians.length)} trong {technicians.length} kết quả
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>{page}</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>

      <TechnicianDetailModal technician={activeTechnician} onClose={() => setActiveTechnician(null)} />
    </div>
  );
}

function TechnicianFormPage({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === 'edit';
  const { can } = usePermission();
  const allowed = isEdit
    ? can('screen:manager:technicians:update')
    : can('screen:manager:technicians:create');

  const [branch, setBranch] = useState(null);
  const [teamLeaderOptions, setTeamLeaderOptions] = useState([]);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', teamLeaderId: '', status: 'active',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    managerApi.getBranch().then((data) => { if (mounted) setBranch(data); }).catch(() => {});
    managerApi.getTeamLeaderOptions().then((data) => { if (mounted) setTeamLeaderOptions(data || []); }).catch(() => {});

    if (isEdit && id) {
      managerApi
        .getTechnicianById(id)
        .then((data) => {
          if (!mounted || !data) return;
          setForm({
            fullName: data.fullName || '',
            email: data.email || '',
            phone: data.phone || '',
            teamLeaderId: data.teamLeaderId ? String(data.teamLeaderId) : '',
            status: data.status || 'active',
          });
        })
        .catch((err) => { if (mounted) setError(err.message || 'Không tải được thông tin thợ máy'); })
        .finally(() => { if (mounted) setLoading(false); });
    }

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên';
    if (!form.email.trim()) errors.email = 'Vui lòng nhập email';
    else if (!EMAIL_REGEX.test(form.email.trim())) errors.email = 'Email không đúng định dạng';
    if (!form.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    else if (!PHONE_REGEX.test(form.phone.trim())) errors.phone = 'Số điện thoại không hợp lệ';
    if (!form.teamLeaderId) errors.teamLeaderId = 'Vui lòng chọn tổ trưởng phụ trách';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        teamLeaderId: Number(form.teamLeaderId),
        status: form.status,
      };

      if (isEdit) {
        await managerApi.updateTechnician(id, payload);
      } else {
        await managerApi.createTechnician(payload);
      }
      navigate('/manager/technicians');
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  if (!allowed) {
    return <Navigate to="/manager/technicians" replace />;
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏳</div>
        <h3>Đang tải thông tin thợ máy</h3>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{isEdit ? 'Chỉnh sửa thợ máy' : 'Thêm thợ máy'}</h1>
          <div className="breadcrumb">Thợ máy / {isEdit ? 'Chỉnh sửa' : 'Thêm mới'}</div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {teamLeaderOptions.length === 0 && (
        <div style={{ background: '#FFF3E0', border: '1px solid #FFD9A0', color: '#B45309', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          ⚠️ Chi nhánh chưa có tổ trưởng nào đang hoạt động. Hãy thêm Tổ trưởng trước khi thêm thợ máy.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="table-wrapper" style={{ padding: 20, marginBottom: 16 }}>
          <div className="form-section-title">🛠️ Thông tin thợ máy</div>

          {branch && (
            <div style={{ background: 'var(--primary-very-light)', border: '1px solid var(--primary-light)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--primary-dark)' }}>
              📍 Chi nhánh: <strong>{branch.name}</strong>
              {!isEdit && ' — Thợ máy mới sẽ được thêm vào chi nhánh này.'}
            </div>
          )}

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Họ và tên</label>
              <input className="form-input" value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} placeholder="Nhập họ và tên" />
              {fieldErrors.fullName && <span className="form-error">{fieldErrors.fullName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Email</label>
              <input className="form-input" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="email@autogara.vn" />
              {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Số điện thoại</label>
              <input className="form-input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="0xxxxxxxxx" />
              {fieldErrors.phone && <span className="form-error">{fieldErrors.phone}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required">Tổ trưởng phụ trách</label>
              <select className="form-select" value={form.teamLeaderId} onChange={(e) => setField('teamLeaderId', e.target.value)}>
                <option value="">-- Chọn tổ trưởng --</option>
                {teamLeaderOptions.map((tl) => (
                  <option key={tl.id} value={tl.id}>{tl.fullName}</option>
                ))}
              </select>
              {fieldErrors.teamLeaderId && <span className="form-error">{fieldErrors.teamLeaderId}</span>}
            </div>

            {isEdit && (
              <div className="form-group">
                <label className="form-label required">Trạng thái</label>
                <select className="form-select" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  <option value="active">Đang làm việc</option>
                  <option value="inactive">Nghỉ việc</option>
                </select>
              </div>
            )}
          </div>

        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/manager/technicians')}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Đang lưu...' : isEdit ? '🔄 Cập nhật' : '+ Thêm thợ máy'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ComingSoonPanel({ title }) {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{title}</h1>
          <div className="breadcrumb">Trang chủ / {title}</div>
        </div>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">🚧</div>
        <h3>Trang {title} đang được phát triển</h3>
        <p>Chức năng này sẽ sớm ra mắt.</p>
      </div>
    </div>
  );
}

export default function ManagerPage() {
  return (
    <Routes>
      <Route index element={<Navigate to="employees" replace />} />
      <Route path="dashboard" element={<ManagerDashboardPage />} />
      <Route path="inventory" element={<ManagerInventoryPage />} />
      <Route path="employees" element={<EmployeeListPage />} />
      <Route path="employees/create" element={<EmployeeFormPage mode="create" />} />
      <Route path="employees/:id/edit" element={<EmployeeFormPage mode="edit" />} />
      <Route path="technicians" element={<TechnicianListPage />} />
      <Route path="technicians/create" element={<TechnicianFormPage mode="create" />} />
      <Route path="technicians/:id/edit" element={<TechnicianFormPage mode="edit" />} />
      <Route path="services" element={<ServiceListPage />} />
      <Route path="services/create" element={<ServiceFormPage mode="create" />} />
      <Route path="services/:id/edit" element={<ServiceFormPage mode="edit" />} />
      <Route path="service-packages" element={<ServicePackageListPage />} />
      <Route path="service-packages/create" element={<ServicePackageFormPage mode="create" />} />
      <Route path="service-packages/:id/edit" element={<ServicePackageFormPage mode="edit" />} />
      <Route path="settlements" element={<SettlementReportsPage />} />
      <Route path="import-requests" element={<ManagerImportRequestListPage />} />
      <Route path="import-requests/:id" element={<ManagerImportRequestDetailPage />} />
      <Route path="export-requests" element={<ManagerExportRequestListPage />} />
      <Route path="export-requests/:id" element={<ManagerExportRequestDetailPage />} />
      <Route path="*" element={<Navigate to="employees" replace />} />
    </Routes>
  );
}
