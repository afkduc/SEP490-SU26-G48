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

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
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
          <div className="modal__title-block">
            <div className="modal__title-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h2 className="modal__title">{isEdit ? 'Chinh sua nguoi dung' : 'Tao nguoi dung moi'}</h2>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {apiError && <div className="form-error">{apiError}</div>}

          <form onSubmit={handleSubmit}>
            {/* Section: Thong tin dang nhap */}
            <div className="form__section">
              <div className="form__section-title">Thong tin dang nhap</div>
              <div className="form__row">
                <div className="form__field">
                  <label className="form__label">Ten dang nhap <span className="required">*</span></label>
                  <input
                    className={`input ${errors.name ? 'input--error' : ''}`}
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={isEdit}
                    placeholder="nguyen_van_a"
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
                  />
                  {errors.email && <span className="form__err">{errors.email}</span>}
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
                    placeholder="Nhap mat khau manh"
                  />
                  {errors.password && <span className="form__err">{errors.password}</span>}
                </div>
              )}
            </div>

            {/* Section: Thong tin ca nhan */}
            <div className="form__section">
              <div className="form__section-title">Thong tin ca nhan</div>
              <div className="form__row">
                <div className="form__field">
                  <label className="form__label">Ho</label>
                  <input
                    className="input"
                    value={form.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    placeholder="Nguyen"
                  />
                </div>
                <div className="form__field">
                  <label className="form__label">Ten <span className="required">*</span></label>
                  <input
                    className="input"
                    value={form.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    placeholder="Van A"
                  />
                </div>
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

            {/* Section: Phan cong */}
            <div className="form__section">
              <div className="form__section-title">Phan cong & trang thai</div>
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
                  <label className="form__label">Trang thai tai khoan</label>
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
            Huy
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
                Dang xu ly...
              </>
            ) : (isEdit ? 'Luu thay doi' : 'Tao nguoi dung')}
          </button>
        </div>
      </div>
    </div>
  );
}
