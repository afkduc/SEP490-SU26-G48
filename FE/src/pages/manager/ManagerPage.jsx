import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { formatCurrency, formatDate } from '../../utils';
import managerApi from '../../services/managerApi';
import { PermissionGate } from '../../components/PermissionGate';
import ManagerImportRequestListPage from './ManagerImportRequestListPage';
import ManagerImportRequestDetailPage from './ManagerImportRequestDetailPage';
import ManagerExportRequestListPage from './ManagerExportRequestListPage';
import ManagerExportRequestDetailPage from './ManagerExportRequestDetailPage';

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
  { value: 'all', label: 'Tất cả' },
  { value: 'waiting_repair', label: 'Chờ sửa chữa' },
  { value: 'inprogress', label: 'Đang sửa chữa' },
  { value: 'waiting_payment', label: 'Chờ thanh toán' },
  { value: 'invoiced', label: 'Đã xuất hóa đơn' },
];

const SETTLEMENT_STATUS_META = {
  waiting_repair: { label: 'Chờ sửa chữa', color: '#E65100', background: '#FFF3E0' },
  inprogress: { label: 'Đang sửa chữa', color: '#1565C0', background: '#E3F2FD' },
  waiting_payment: { label: 'Chờ thanh toán', color: '#2E7D32', background: '#E8F5E9' },
  invoiced: { label: 'Đã xuất hóa đơn', color: '#424242', background: '#F5F5F5' },
};

function settlementStatusBadge(status) {
  return SETTLEMENT_STATUS_META[status] || { label: status || 'Không rõ', color: '#334155', background: '#F1F5F9' };
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, padding: '7px 0', borderBottom: '1px solid #ECEFF1' }}>
      <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827' }}>{value || '—'}</div>
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
  const isTeamLeader = employee?.roles?.includes('team_leader');

  useEffect(() => {
    if (!employee?.id || !isTeamLeader) { setMembers(null); setSpecialties(null); return undefined; }
    let mounted = true;
    setMembers(null);
    setSpecialties(null);
    managerApi.getEmployeeById(employee.id)
      .then((data) => {
        if (!mounted) return;
        setMembers(data?.members || []);
        setSpecialties(data?.specialties || []);
      })
      .catch(() => { if (mounted) { setMembers([]); setSpecialties([]); } });
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
          <PermissionGate permission="manager:employees:read">
            <button type="button" className="btn btn-secondary" onClick={() => exportEmployeesCsv(employees)}>
              📊 Xuất Excel
            </button>
          </PermissionGate>
          <PermissionGate permission="manager:employees:create">
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
                      <PermissionGate permission="manager:employees:read">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Xem chi tiết" onClick={() => setActiveEmployee(employee)}>👁</button>
                      </PermissionGate>
                      <PermissionGate permission="manager:employees:update">
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

  const [branch, setBranch] = useState(null);
  const [roles, setRoles] = useState([]);
  const [specialtyOptions, setSpecialtyOptions] = useState([]);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', roleId: '', status: 'active', password: '', confirmPassword: '', specialtyIds: [],
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    managerApi.getBranch().then((data) => { if (mounted) setBranch(data); }).catch(() => {});
    managerApi.getRoles().then((data) => { if (mounted) setRoles(data || []); }).catch(() => {});
    managerApi.getSpecialties().then((data) => { if (mounted) setSpecialtyOptions(data || []); }).catch(() => {});

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
            specialtyIds: (data.specialties || []).map((s) => s.id),
          });
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

  const toggleSpecialty = (specialtyId) => {
    setForm((prev) => {
      const exists = prev.specialtyIds.includes(specialtyId);
      return {
        ...prev,
        specialtyIds: exists ? prev.specialtyIds.filter((sid) => sid !== specialtyId) : [...prev.specialtyIds, specialtyId],
      };
    });
  };

  const validate = () => {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên';
    if (!form.email.trim()) errors.email = 'Vui lòng nhập email';
    else if (!EMAIL_REGEX.test(form.email.trim())) errors.email = 'Email không đúng định dạng';
    if (!form.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    else if (!PHONE_REGEX.test(form.phone.trim())) errors.phone = 'Số điện thoại không hợp lệ';
    if (!form.roleId) errors.roleId = 'Vui lòng chọn vai trò';
    if (!isEdit) {
      if (!form.password) errors.password = 'Vui lòng nhập mật khẩu tạm thời';
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

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        roleId: Number(form.roleId),
        status: form.status,
        specialtyIds: isTeamLeaderRole ? form.specialtyIds : [],
      };

      if (isEdit) {
        await managerApi.updateEmployee(id, payload);
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
              <input className="form-input" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="email@autogara.vn" />
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

          {isTeamLeaderRole && (
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Chuyên môn</label>
              {specialtyOptions.length === 0 ? (
                <p className="form-hint">Chưa có danh mục chuyên môn nào trong hệ thống.</p>
              ) : (
                <div style={{ border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', maxHeight: 220, overflowY: 'auto' }}>
                  {specialtyOptions.map((s) => (
                    <label
                      key={s.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--gray-100)', fontSize: 13, cursor: 'pointer' }}
                    >
                      <input type="checkbox" checked={form.specialtyIds.includes(s.id)} onChange={() => toggleSpecialty(s.id)} />
                      <span>{s.name}</span>
                    </label>
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
              <p className="form-hint" style={{ marginTop: 8 }}>Nhân viên sẽ đổi mật khẩu lần đầu đăng nhập.</p>
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
            <div className="detail-row"><div className="detail-label">Danh mục</div><div className="detail-value">{service.categoryName || '—'}</div></div>
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
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeService, setActiveService] = useState(null);
  const [page, setPage] = useState(1);
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    let mounted = true;
    managerApi.getServiceCategories().then((data) => { if (mounted) setCategories(data || []); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const reload = () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    managerApi
      .getServices({ search: search.trim(), categoryId, status })
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
  }, [search, categoryId, status]);

  const clearFilters = () => {
    setSearch('');
    setCategoryId('all');
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
          <PermissionGate permission="manager:services:read">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportCsv(
                'danh-sach-dich-vu.csv',
                ['Mã DV', 'Tên dịch vụ', 'Danh mục', 'Đơn giá', 'Thời gian (phút)', 'Trạng thái'],
                services.map((s) => [s.code, s.name, s.categoryName, s.unitPrice, s.durationMin, activeBadge(s.isActive).label])
              )}
            >
              📊 Xuất Excel
            </button>
          </PermissionGate>
          <PermissionGate permission="manager:services:create">
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

        <select className="filter-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="all">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
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
              <th>Danh mục</th>
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
                  <td>{service.categoryName || '—'}</td>
                  <td>{formatCurrency(service.unitPrice)}</td>
                  <td>{service.durationMin ? `${service.durationMin} phút` : '—'}</td>
                  <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                  <td>
                    <div className="table-actions">
                      <PermissionGate permission="manager:services:read">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Xem chi tiết" onClick={() => setActiveService(service)}>👁</button>
                      </PermissionGate>
                      <PermissionGate permission="manager:services:update">
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
  { value: 'CB', label: 'Sửa chữa gầm - phanh' },
  { value: 'EE', label: 'Sửa chữa điện - điện tử' },
  { value: 'BP', label: 'Đồng sơn' },
  { value: 'PM', label: 'Bảo dưỡng định kỳ' },
];

function ServiceFormPage({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === 'edit';

  const [branch, setBranch] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    serviceName: '', categoryId: '', unitPrice: '', durationMin: '', description: '', isActive: true, repairCategory: '',
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
    managerApi.getServiceCategories().then((data) => { if (mounted) setCategories(data || []); }).catch(() => {});
    managerApi.getProducts().then((data) => { if (mounted) setProducts(data || []); }).catch(() => {});

    if (isEdit && id) {
      managerApi
        .getServiceById(id)
        .then((data) => {
          if (!mounted || !data) return;
          setForm({
            serviceName: data.name || '',
            categoryId: data.categoryId ? String(data.categoryId) : '',
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
    if (!form.categoryId) errors.categoryId = 'Vui lòng chọn danh mục';
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
        categoryId: Number(form.categoryId),
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
              <label className="form-label required">Danh mục</label>
              <select className="form-select" value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)}>
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {fieldErrors.categoryId && <span className="form-error">{fieldErrors.categoryId}</span>}
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
            <div className="detail-row"><div className="detail-label">Danh mục</div><div className="detail-value">{pkg.categoryName || '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Mốc km áp dụng</div><div className="detail-value">{pkg.applicableKm ? `${pkg.applicableKm} km` : '—'}</div></div>
            <div className="detail-row"><div className="detail-label">Giá gói</div><div className="detail-value">{formatCurrency(pkg.totalPrice)}</div></div>
            <div className="detail-row"><div className="detail-label">Mô tả</div><div className="detail-value">{pkg.description || '—'}</div></div>
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
      .getServicePackages({ search: search.trim(), status })
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
  }, [search, status]);

  const clearFilters = () => {
    setSearch('');
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
          <PermissionGate permission="manager:services:read">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportCsv(
                'danh-sach-goi-dich-vu.csv',
                ['Mã gói', 'Tên gói', 'Danh mục', 'Số dịch vụ', 'Giá gói', 'Trạng thái'],
                packages.map((p) => [p.code, p.name, p.categoryName, p.itemCount, p.totalPrice, activeBadge(p.isActive).label])
              )}
            >
              📊 Xuất Excel
            </button>
          </PermissionGate>
          <PermissionGate permission="manager:services:create">
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
              <th>Danh mục</th>
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
                  <td>{pkg.categoryName || '—'}</td>
                  <td>{pkg.itemCount}</td>
                  <td>{formatCurrency(pkg.totalPrice)}</td>
                  <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                  <td>
                    <div className="table-actions">
                      <PermissionGate permission="manager:services:read">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Xem chi tiết" onClick={() => openDetail(pkg)}>👁</button>
                      </PermissionGate>
                      <PermissionGate permission="manager:services:update">
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

  const [branch, setBranch] = useState(null);
  const [categories, setCategories] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [form, setForm] = useState({
    packageName: '', categoryId: '', applicableKm: '', totalPrice: '', description: '', isActive: true, repairCategory: '', serviceIds: [],
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    managerApi.getBranch().then((data) => { if (mounted) setBranch(data); }).catch(() => {});
    managerApi.getServiceCategories().then((data) => { if (mounted) setCategories(data || []); }).catch(() => {});
    managerApi.getServices({ status: 'all' }).then((data) => { if (mounted) setAvailableServices(data || []); }).catch(() => {});

    if (isEdit && id) {
      managerApi
        .getServicePackageById(id)
        .then((data) => {
          if (!mounted || !data) return;
          setForm({
            packageName: data.name || '',
            categoryId: data.categoryId ? String(data.categoryId) : '',
            applicableKm: data.applicableKm ?? '',
            totalPrice: data.totalPrice ?? '',
            description: data.description || '',
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
    if (!form.categoryId) errors.categoryId = 'Vui lòng chọn danh mục';
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
        categoryId: Number(form.categoryId),
        applicableKm: form.applicableKm === '' ? null : Number(form.applicableKm),
        totalPrice: Number(form.totalPrice),
        description: form.description.trim(),
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
              <label className="form-label required">Danh mục</label>
              <select className="form-select" value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)}>
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {fieldErrors.categoryId && <span className="form-error">{fieldErrors.categoryId}</span>}
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

function SettlementDetailModal({ report, onClose }) {
  if (!report) return null;
  const badge = settlementStatusBadge(report.status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 1040 }}>
        <div className="modal-header">
          <h3 className="modal-title">Chi tiết phiếu quyết toán {report.code}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '80vh', overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#EEF6FF', border: '1px solid #D7E7FF', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#54708A' }}>Mã phiếu</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{report.code}</div>
            </div>
            <div style={{ background: '#F7F7F8', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Chi nhánh</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 4 }}>{report.branch?.name || '—'}</div>
            </div>
            <div style={{ background: badge.background, border: `1px solid ${badge.color}33`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: badge.color }}>Trạng thái</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: badge.color, marginTop: 4 }}>{badge.label}</div>
            </div>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#9A3412' }}>Tổng thanh toán</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#C2410C', marginTop: 4 }}>{formatCurrency(report.total)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 18 }}>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Thông tin phiếu</div>
              <DetailRow label="Ngày tiếp nhận" value={formatDate(report.intakeDate)} />
              <DetailRow label="Ngày hoàn thành" value={formatDate(report.completedDate)} />
              <DetailRow label="Tư vấn dịch vụ" value={`${report.advisor?.name || '—'}${report.advisor?.phone ? ` · ${report.advisor.phone}` : ''}`} />
              <DetailRow label="Tổ trưởng" value={report.teamLeader?.name || 'Chưa gán'} />
              <DetailRow label="Yêu cầu khách hàng" value={report.customerRequest} />
            </div>

            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Khách hàng & xe</div>
              <DetailRow label="Khách hàng" value={report.customer?.fullName} />
              <DetailRow label="Điện thoại" value={report.customer?.phone} />
              <DetailRow label="Địa chỉ" value={report.customer?.address} />
              <DetailRow label="Biển số" value={report.vehicle?.licensePlate} />
              <DetailRow label="Dòng xe / Năm" value={`${report.vehicle?.vehicleModel || '—'}${report.vehicle?.manufactureYear ? ` · ${report.vehicle.manufactureYear}` : ''}`} />
              <DetailRow label="Số khung / số máy" value={`${report.vehicle?.frameNumber || '—'} / ${report.vehicle?.engineNumber || '—'}`} />
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Bảng hạng mục</div>
            <div className="table-wrapper" style={{ boxShadow: 'none', marginBottom: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Nội dung</th>
                    <th>Loại</th>
                    <th>HTTT</th>
                    <th>ĐVT</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th>CK %</th>
                    <th>Miễn phí</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.items || []).length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <div className="empty-state" style={{ minHeight: 160 }}>
                          <div className="empty-state-icon">📭</div>
                          <h3>Không có hạng mục</h3>
                        </div>
                      </td>
                    </tr>
                  )}
                  {(report.items || []).map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.code || '—'}</td>
                      <td>{item.description}</td>
                      <td>{item.lhsc || '—'}</td>
                      <td>{item.httt || '—'}</td>
                      <td>{item.unit || '—'}</td>
                      <td>{item.qty || 0}</td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td>{item.discount || 0}%</td>
                      <td>{item.isFree ? 'Có' : ''}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Tổng hợp tài chính</div>
              <DetailRow label="Tổng trước giảm giá" value={formatCurrency(report.subtotal)} />
              <DetailRow label="Tổng giảm giá" value={formatCurrency(report.discountAmount)} />
              <DetailRow label="Tổng sau giảm giá" value={formatCurrency(report.afterDiscount)} />
              <DetailRow label="Thuế GTGT" value={formatCurrency(report.vat)} />
              <DetailRow label="Miễn phí" value={formatCurrency(report.freeAmount)} />
            </div>
            <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: 12, padding: 16, color: 'white' }}>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Tổng thanh toán</div>
              <div style={{ fontSize: 28, fontWeight: 900, margin: '8px 0 6px' }}>{formatCurrency(report.total)}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Dữ liệu lấy trực tiếp từ SQL Server.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettlementReportsPage() {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

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

  const counts = reports.reduce(
    (acc, r) => {
      acc.all += 1;
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { all: 0 }
  );

  const filteredReports = activeTab === 'all' ? reports : reports.filter((r) => r.status === activeTab);

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
              <th>Hoàn thành</th>
              <th>Chi phí</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9}>
                <div className="empty-state">
                  <div className="empty-state-icon">⏳</div>
                  <h3>Đang tải danh sách phiếu quyết toán</h3>
                </div>
              </td></tr>
            )}

            {!loading && filteredReports.length === 0 && !error && (
              <tr><td colSpan={9}>
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
                  <td style={{ fontSize: 12 }}>{formatDate(report.completedDate)}</td>
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
          <PermissionGate permission="manager:technicians:read">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportCsv(
                'danh-sach-tho-may.csv',
                ['Mã NV', 'Họ và tên', 'Email', 'Tổ trưởng', 'Chuyên môn', 'Số điện thoại', 'Ngày vào', 'Trạng thái'],
                technicians.map((t) => [
                  t.employeeId, t.fullName, t.email, t.teamLeaderName,
                  (t.specialties || []).map((s) => s.name).join('; '),
                  t.phone, formatDate(t.createdAt), statusBadge(t.status).label,
                ])
              )}
            >
              📊 Xuất Excel
            </button>
          </PermissionGate>
          <PermissionGate permission="manager:technicians:create">
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
              <th>Chuyên môn</th>
              <th>Số điện thoại</th>
              <th>Ngày vào</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <div className="empty-state-icon">⏳</div>
                  <h3>Đang tải danh sách thợ máy</h3>
                </div>
              </td></tr>
            )}

            {!loading && pageItems.length === 0 && !error && (
              <tr><td colSpan={8}>
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
                  <td>
                    {(technician.specialties || []).slice(0, 2).map((s) => (
                      <span key={s.id} className="tag">{s.name}</span>
                    ))}
                    {(technician.specialties || []).length > 2 && (
                      <span className="tag">+{technician.specialties.length - 2}</span>
                    )}
                    {(technician.specialties || []).length === 0 && '—'}
                  </td>
                  <td>{technician.phone || '—'}</td>
                  <td>{formatDate(technician.createdAt)}</td>
                  <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                  <td>
                    <div className="table-actions">
                      <PermissionGate permission="manager:technicians:read">
                        <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Xem chi tiết" onClick={() => setActiveTechnician(technician)}>👁</button>
                      </PermissionGate>
                      <PermissionGate permission="manager:technicians:update">
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

  const [branch, setBranch] = useState(null);
  const [teamLeaderOptions, setTeamLeaderOptions] = useState([]);
  const [specialtyOptions, setSpecialtyOptions] = useState([]);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', teamLeaderId: '', status: 'active', password: '', confirmPassword: '', specialtyIds: [],
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    managerApi.getBranch().then((data) => { if (mounted) setBranch(data); }).catch(() => {});
    managerApi.getTeamLeaderOptions().then((data) => { if (mounted) setTeamLeaderOptions(data || []); }).catch(() => {});
    managerApi.getSpecialties().then((data) => { if (mounted) setSpecialtyOptions(data || []); }).catch(() => {});

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
            password: '',
            confirmPassword: '',
            specialtyIds: (data.specialties || []).map((s) => s.id),
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

  const toggleSpecialty = (specialtyId) => {
    setForm((prev) => {
      const exists = prev.specialtyIds.includes(specialtyId);
      return {
        ...prev,
        specialtyIds: exists ? prev.specialtyIds.filter((sid) => sid !== specialtyId) : [...prev.specialtyIds, specialtyId],
      };
    });
  };

  const validate = () => {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên';
    if (!form.email.trim()) errors.email = 'Vui lòng nhập email';
    else if (!EMAIL_REGEX.test(form.email.trim())) errors.email = 'Email không đúng định dạng';
    if (!form.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    else if (!PHONE_REGEX.test(form.phone.trim())) errors.phone = 'Số điện thoại không hợp lệ';
    if (!form.teamLeaderId) errors.teamLeaderId = 'Vui lòng chọn tổ trưởng phụ trách';
    if (!isEdit) {
      if (!form.password) errors.password = 'Vui lòng nhập mật khẩu tạm thời';
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

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        teamLeaderId: Number(form.teamLeaderId),
        status: form.status,
        specialtyIds: form.specialtyIds,
      };

      if (isEdit) {
        await managerApi.updateTechnician(id, payload);
      } else {
        await managerApi.createTechnician({ ...payload, password: form.password, confirmPassword: form.confirmPassword });
      }
      navigate('/manager/technicians');
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

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

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Chuyên môn</label>
            {specialtyOptions.length === 0 ? (
              <p className="form-hint">Chưa có danh mục chuyên môn nào trong hệ thống.</p>
            ) : (
              <div style={{ border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', maxHeight: 220, overflowY: 'auto' }}>
                {specialtyOptions.map((s) => (
                  <label
                    key={s.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--gray-100)', fontSize: 13, cursor: 'pointer' }}
                  >
                    <input type="checkbox" checked={form.specialtyIds.includes(s.id)} onChange={() => toggleSpecialty(s.id)} />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

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
              <p className="form-hint" style={{ marginTop: 8 }}>Thợ máy sẽ đổi mật khẩu lần đầu đăng nhập.</p>
            </>
          )}
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
