import { useEffect, useState } from 'react';
import { adminBranchesApi, adminRolesApi, adminUsersApi } from '../../../services/adminApi';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Hoat dong' },
  { value: 'inactive', label: 'Ngung hoat dong' },
  { value: 'locked', label: 'Bi khoa' },
];

export default function UserFormModal({ user, onClose, onSuccess }) {
  const isEdit = Boolean(user);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    fullName: '',
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

  // Load dropdown data
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

  // Pre-fill when editing
  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      fullName: user.fullName || '',
      phone: user.phone || '',
      branchId: user.branchId ? String(user.branchId) : '',
      roleId: user.roles?.[0] ? String(user.roles[0]) : '',
      status: user.status || 'active',
    });
  }, [user]);

  function validate() {
    const errs = {};
    if (!isEdit && !form.name.trim()) errs.name = 'Ten dang nhap la bat buoc';
    if (!isEdit && !form.email.trim()) errs.email = 'Email la bat buoc';
    if (!isEdit && !form.password) errs.password = 'Mat khau la bat buoc';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Email khong dung dinh dang';
    }
    if (form.phone && !/^0[0-9]{9,10}$/.test(form.phone)) {
      errs.phone = 'So dien thoai phai bat dau bang 0, 10-11 chu so';
    }
    if (!isEdit && !form.branchId) errs.branchId = 'Chi nhanh la bat buoc';
    if (!isEdit && !form.roleId) errs.roleId = 'Role la bat buoc';
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
          roleId: form.roleId || null,
        };
        await adminUsersApi.update(payload);
      } else {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim() || form.name.trim(),
          phone: form.phone.trim() || undefined,
          branchId: Number(form.branchId),
          roleId: Number(form.roleId),
        };
        await adminUsersApi.create(payload);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setApiError(err?.response?.data?.message || err.message || 'Loi he thong');
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
          <h2 className="modal__title">{isEdit ? 'Sua nguoi dung' : 'Tao nguoi dung moi'}</h2>
          <button className="modal__close" onClick={onClose} type="button">✕</button>
        </div>

        {apiError && <div className="form-error">{apiError}</div>}

        <form className="form" onSubmit={handleSubmit}>
          <div className="form__row">
            <div className="form__field">
              <label className="form__label">Ten dang nhap <span className="required">*</span></label>
              <input
                className={`input ${errors.name ? 'input--error' : ''}`}
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={isEdit}
                placeholder="user_login_name"
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
                placeholder="user@example.com"
              />
              {errors.email && <span className="form__err">{errors.email}</span>}
            </div>
          </div>

          <div className="form__row">
            <div className="form__field">
              <label className="form__label">Ho va ten</label>
              <input
                className="input"
                value={form.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="Nguyen Van A"
              />
            </div>

            <div className="form__field">
              <label className="form__label">So dien thoai</label>
              <input
                className={`input ${errors.phone ? 'input--error' : ''}`}
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="0912345678"
              />
              {errors.phone && <span className="form__err">{errors.phone}</span>}
            </div>
          </div>

          {!isEdit && (
            <div className="form__field">
              <label className="form__label">Mat khau <span className="required">*</span></label>
              <input
                className={`input ${errors.password ? 'input--error' : ''}`}
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="********"
              />
              {errors.password && <span className="form__err">{errors.password}</span>}
            </div>
          )}

          <div className="form__row">
            <div className="form__field">
              <label className="form__label">Chi nhanh <span className="required">*</span></label>
              <select
                className={`input input--select ${errors.branchId ? 'input--error' : ''}`}
                value={form.branchId}
                onChange={(e) => handleChange('branchId', e.target.value)}
                disabled={isEdit}
              >
                <option value="">-- Chon chi nhanh --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branchName}</option>
                ))}
              </select>
              {errors.branchId && <span className="form__err">{errors.branchId}</span>}
            </div>

            <div className="form__field">
              <label className="form__label">Role <span className="required">*</span></label>
              <select
                className={`input input--select ${errors.roleId ? 'input--error' : ''}`}
                value={form.roleId}
                onChange={(e) => handleChange('roleId', e.target.value)}
              >
                <option value="">-- Chon role --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.roleName}</option>
                ))}
              </select>
              {errors.roleId && <span className="form__err">{errors.roleId}</span>}
            </div>
          </div>

          {isEdit && (
            <div className="form__field">
              <label className="form__label">Trang thai</label>
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

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
              Huy
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Dang xu ly...' : (isEdit ? 'Luu thay doi' : 'Tao nguoi dung')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
