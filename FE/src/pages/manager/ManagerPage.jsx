import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { formatDate } from '../../utils';
import managerApi from '../../services/managerApi';

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
          <button type="button" className="btn btn-secondary" onClick={() => exportEmployeesCsv(employees)}>
            📊 Xuất Excel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/manager/employees/create')}>
            + Thêm nhân viên
          </button>
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
                      <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Xem chi tiết" onClick={() => setActiveEmployee(employee)}>👁</button>
                      <button type="button" className="btn btn-secondary btn-icon btn-sm" title="Chỉnh sửa" onClick={() => navigate(`/manager/employees/${employee.id}/edit`)}>✏️</button>
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
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', roleId: '', status: 'active', password: '', confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
        })
        .catch((err) => { if (mounted) setError(err.message || 'Không tải được thông tin nhân viên'); })
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
      <Route path="technicians" element={<ComingSoonPanel title="Thợ máy" />} />
      <Route path="team-leaders" element={<ComingSoonPanel title="Tổ trưởng" />} />
      <Route path="*" element={<Navigate to="employees" replace />} />
    </Routes>
  );
}
