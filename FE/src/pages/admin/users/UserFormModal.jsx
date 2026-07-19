import { useEffect, useState } from 'react';
import { adminBranchesApi, adminRolesApi, adminUsersApi } from '../../../services/adminApi';
import './UserFormModal.css';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
  { value: 'locked', label: 'Bị khóa' },
];

/**
 * Lay roleId tu user.roles (da hoac chua fetch roles list)
 * @param {Array} userRoles - roles array tu user object (string[] hoac object[])
 * @param {Array} allRoles  - roles tu API dropdown
 * @returns {string} roleId hoac ''
 */
function resolveRoleId(userRoles, allRoles) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return '';
  const first = userRoles[0];

  // Backend moi: { roleId, roleName }
  if (typeof first === 'object' && first !== null) {
    return first.roleId !== undefined && first.roleId !== null
      ? String(first.roleId)
      : '';
  }

  // Backend cu: ['Admin', ...] -> map ten -> id
  if (typeof first === 'string') {
    const match = allRoles.find((r) => r.roleName === first || String(r.id) === first);
    return match ? String(match.id) : '';
  }

  return '';
}

export default function UserFormModal({ user, onClose, onSuccess }) {
  const isEdit = Boolean(user);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    branchId: '',
    roleId: '',
    status: 'active',
  });

  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Load branches + roles dropdown
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bRes, rRes] = await Promise.all([
          adminBranchesApi.list(),
          adminRolesApi.list(),
        ]);
        if (!cancelled) {
          setBranches(bRes?.items || []);
          setRoles(rRes?.items || []);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Khi user object hoac roles list thay doi -> cap nhat form
  useEffect(() => {
    if (!user) return;

    // Neu roles chua load xong, bo qua (effect tiep theo se trigger)
    const resolvedRoleId = resolveRoleId(user.roles, roles);

    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      branchId:
        user.branchId !== undefined && user.branchId !== null
          ? String(user.branchId)
          : '',
      roleId: resolvedRoleId,
      status: user.status || 'active',
    });
  }, [user, JSON.stringify(roles)]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    const errs = {};
    if (!isEdit && !form.name.trim()) errs.name = 'Tên đăng nhập là bắt buộc';
    if (!isEdit && !form.email.trim()) errs.email = 'Email là bắt buộc';
    if (!isEdit && !form.password) errs.password = 'Mật khẩu là bắt buộc';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Email không đúng định dạng';
    }
    if (form.phone && !/^0[0-9]{9,10}$/.test(form.phone)) {
      errs.phone = 'Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số';
    }
    if (!form.branchId) errs.branchId = 'Chi nhánh là bắt buộc';
    if (!form.roleId) errs.roleId = 'Vai trò là bắt buộc';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setApiError('');

    try {
      if (isEdit) {
        const payload = {
          userId: user.id,
          status: form.status,
          roleId: form.roleId ? Number(form.roleId) : null,
          branchId: form.branchId ? Number(form.branchId) : null,
        };
        await adminUsersApi.update(payload);
      } else {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim() || form.name.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || undefined,
          branchId: Number(form.branchId),
          roleId: Number(form.roleId),
        };
        await adminUsersApi.create(payload);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setApiError(err?.response?.data?.message || err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal">
        <div className="modal__header">
          <div className="modal__title-block">
            <div className="modal__title-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h2 className="modal__title">{isEdit ? 'Chỉnh sửa người dùng' : 'Tạo người dùng mới'}</h2>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {apiError && <div className="form-error">{apiError}</div>}

          <form onSubmit={handleSubmit} autoComplete="off">
            {/* Section: Thông tin đăng nhập */}
            <div className="form__section">
              <div className="form__section-title">Thông tin đăng nhập</div>
              <div className="form__row">
                <div className="form__field">
                  <label className="form__label">Tên đăng nhập <span className="required">*</span></label>
                  <input
                    className={`input ${errors.name ? 'input--error' : ''}`}
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={isEdit}
                    placeholder="nguyen_van_a"
                    autoComplete="off"
                  />
                  {errors.name && <span className="form__err">{errors.name}</span>}
                </div>
                <div className="form__field">
                  <label className="form__label">Email <span className="required">*</span></label>
                  <input
                    className={`input ${errors.email ? 'input--error' : ''}`}
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    disabled={isEdit}
                    placeholder="user@autogara.vn"
                    autoComplete="off"
                  />
                  {errors.email && <span className="form__err">{errors.email}</span>}
                </div>
              </div>

              {!isEdit && (
                <div className="form__field">
                  <label className="form__label">Mật khẩu <span className="required">*</span></label>
                  <input
                    className={`input ${errors.password ? 'input--error' : ''}`}
                    type="password"
                    value={form.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="Nhập mật khẩu mạnh"
                    autoComplete="new-password"
                  />
                  {errors.password && <span className="form__err">{errors.password}</span>}
                </div>
              )}
            </div>

            {/* Section: Thông tin cá nhân */}
            <div className="form__section">
              <div className="form__section-title">Thông tin cá nhân</div>
              <div className="form__row">
                <div className="form__field">
                  <label className="form__label">Họ</label>
                  <input
                    className="input"
                    value={form.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    placeholder="Nguyễn"
                    autoComplete="off"
                  />
                </div>
                <div className="form__field">
                  <label className="form__label">Tên <span className="required">*</span></label>
                  <input
                    className="input"
                    value={form.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    placeholder="Văn A"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="form__field">
                <label className="form__label">Số điện thoại</label>
                <input
                  className={`input ${errors.phone ? 'input--error' : ''}`}
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="0912345678"
                  autoComplete="tel"
                />
                {errors.phone && <span className="form__err">{errors.phone}</span>}
              </div>
            </div>

            {/* Section: Phân công */}
            <div className="form__section">
              <div className="form__section-title">Phân công & trạng thái</div>
              <div className="form__row">
                <div className="form__field">
                  <label className="form__label">Chi nhánh <span className="required">*</span></label>
                  <select
                    className={`input input--select ${errors.branchId ? 'input--error' : ''}`}
                    value={form.branchId}
                    onChange={(e) => handleChange('branchId', e.target.value)}
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.branchName}</option>
                    ))}
                  </select>
                  {errors.branchId && <span className="form__err">{errors.branchId}</span>}
                </div>
                <div className="form__field">
                  <label className="form__label">Vai trò <span className="required">*</span></label>
                  <select
                    className={`input input--select ${errors.roleId ? 'input--error' : ''}`}
                    value={form.roleId}
                    onChange={(e) => handleChange('roleId', e.target.value)}
                  >
                    <option value="">-- Chọn vai trò --</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.roleName}</option>
                    ))}
                  </select>
                  {errors.roleId && <span className="form__err">{errors.roleId}</span>}
                </div>
              </div>

              {isEdit && (
                <div className="form__field">
                  <label className="form__label">Trạng thái tài khoản</label>
                  <select
                    className="input input--select"
                    value={form.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.7s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Đang xử lý...
              </>
            ) : (isEdit ? 'Lưu thay đổi' : 'Tạo người dùng')}
          </button>
        </div>
      </div>
    </div>
  );
}
