import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  adminBranchesApi,
  adminRolesApi,
  adminUsersApi,
} from '../../../services/adminApi';
import { useToast } from '../../../components/common/ToastContext';
import {
  EMAIL_HINT,
  formatPhoneInput,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  isValidUsername,
  phoneDigitsOnly,
} from '../../../utils/validation';
import ResetPasswordModal from './ResetPasswordModal';
import './UserFormPage.css';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
];

const ALL_BRANCHES_SENTINEL = '__ALL__';
const ADMIN_ROLE_ID = 7;

function hasAdminRole(userRoles) {
  if (!Array.isArray(userRoles)) return false;
  return userRoles.some((r) => {
    const id = typeof r === 'object' && r !== null ? r.roleId : r;
    return Number(id) === ADMIN_ROLE_ID;
  });
}

function resolveRoleId(userRoles, allRoles) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return '';
  const first = userRoles[0];
  let resolvedId = '';
  if (typeof first === 'object' && first !== null) {
    resolvedId = first.roleId !== undefined && first.roleId !== null
      ? String(first.roleId)
      : '';
  } else if (typeof first === 'string') {
    const match = allRoles.find((r) => r.roleName === first || String(r.id) === first);
    resolvedId = match ? String(match.id) : '';
  }
  return resolvedId;
}

function hasMultipleRoles(userRoles) {
  return Array.isArray(userRoles) && userRoles.length >= 2;
}

/**
 * @param {{ mode?: 'create' | 'edit' }} props
 */
export default function UserFormPage({ mode: modeProp }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const isEdit = modeProp === 'edit' || Boolean(id);
  const listSearch = location.state?.fromListSearch || '';
  const backToList = `/admin/users${listSearch}`;

  const [user, setUser] = useState(null);
  const [bootLoading, setBootLoading] = useState(isEdit);
  const [bootError, setBootError] = useState('');

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
    scopeAllBranches: false,
  });

  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showReset, setShowReset] = useState(false);

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
      } catch (_) {
        /* dropdown optional on fail */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEdit || !id) {
      setBootLoading(false);
      return undefined;
    }
    let cancelled = false;
    setBootLoading(true);
    setBootError('');
    (async () => {
      try {
        const res = await adminUsersApi.getDetail(id);
        if (!cancelled) setUser(res);
      } catch (err) {
        if (!cancelled) setBootError(err.message || 'Không tải được người dùng');
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, id]);

  useEffect(() => {
    if (!user) return;
    const resolvedRoleId = resolveRoleId(user.roles, roles);
    const isAllBranches = user.scopeAllBranches === true
      || user.branchId === null
      || user.branchId === undefined;
    let branchIdValue = '';
    if (isAllBranches) {
      branchIdValue = ALL_BRANCHES_SENTINEL;
    } else if (user.branchId !== undefined && user.branchId !== null) {
      branchIdValue = String(user.branchId);
    }
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: formatPhoneInput(user.phone || ''),
      branchId: branchIdValue,
      roleId: resolvedRoleId,
      status: user.status || 'active',
      scopeAllBranches: isAllBranches,
    });
    setErrors({});
    setApiError('');
  }, [user, roles]);

  function validate() {
    const errs = {};
    if (!isEdit && !form.name.trim()) errs.name = 'Tên đăng nhập là bắt buộc';
    else if (!isEdit && !isValidUsername(form.name)) {
      errs.name = 'Tên đăng nhập 3–50 ký tự, chỉ gồm chữ, số, ., _, -';
    }
    if (!isEdit && !form.email.trim()) errs.email = 'Email là bắt buộc';
    if (!isEdit && !form.password) errs.password = 'Mật khẩu là bắt buộc';
    if (!isEdit && form.password && !isValidPassword(form.password)) {
      errs.password = 'Mật khẩu tối thiểu 6 ký tự, gồm chữ và số';
    }
    if (!form.lastName.trim()) errs.lastName = 'Tên là bắt buộc';
    if (form.email && !isValidEmail(form.email)) {
      errs.email = EMAIL_HINT;
    }
    if (!form.phone.trim()) {
      errs.phone = 'Số điện thoại là bắt buộc';
    } else if (!isValidPhone(form.phone)) {
      errs.phone = 'Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số';
    }
    if (!form.branchId) errs.branchId = 'Chi nhánh là bắt buộc (hoặc chọn "Tất cả chi nhánh")';
    if (!form.roleId && !(isEdit && hasMultipleRoles(user?.roles))) {
      errs.roleId = 'Vai trò là bắt buộc';
    }
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
        const shouldSendRoleId = form.roleId && form.roleId !== '';
        const payload = {
          userId: user.id,
          firstName: form.firstName?.trim() || user.firstName || '',
          lastName: form.lastName?.trim() || user.lastName || '',
          email: form.email?.trim() || user.email,
          phone: phoneDigitsOnly(form.phone),
          status: form.status,
        };
        if (form.scopeAllBranches) {
          payload.scopeAllBranches = true;
          payload.branchId = null;
        } else {
          payload.branchId = form.branchId ? Number(form.branchId) : null;
        }
        if (shouldSendRoleId) {
          payload.roleId = Number(form.roleId);
        }
        await adminUsersApi.update(payload);
        toast.success('Đã cập nhật người dùng');
        navigate(backToList);
      } else {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim() || form.name.trim(),
          lastName: form.lastName.trim(),
          phone: phoneDigitsOnly(form.phone),
          roleId: Number(form.roleId),
        };
        if (form.scopeAllBranches) {
          payload.scopeAllBranches = true;
          payload.branchId = null;
        } else {
          payload.branchId = Number(form.branchId);
        }
        const created = await adminUsersApi.create(payload);
        toast.success('Đã tạo người dùng');
        const newId = created?.id || created?.userId;
        navigate(newId ? `/admin/users/${newId}` : backToList);
      }
    } catch (err) {
      setApiError(err?.response?.data?.message || err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'branchId') {
        next.scopeAllBranches = value === ALL_BRANCHES_SENTINEL;
      }
      return next;
    });
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  if (bootLoading) {
    return (
      <div className="admin-page admin-user-form-page">
        <div className="admin-user-form-page__state">Đang tải...</div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="admin-page admin-user-form-page">
        <div className="admin-user-form-page__state admin-user-form-page__state--error">{bootError}</div>
        <Link to={backToList} className="btn btn--ghost">Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="admin-page admin-user-form-page">
      <div className="admin-page__header">
        <div className="admin-page__title-block">
          <button
            type="button"
            className="admin-user-form-page__back"
            onClick={() => navigate(backToList)}
          >
            ← Quay lại
          </button>
          <div className="admin-page__title-group">
            <h1>{isEdit ? 'Chỉnh sửa người dùng' : 'Tạo người dùng mới'}</h1>
          </div>
        </div>
      </div>

      <div className="admin-user-form-page__card">
        {apiError && <div className="form-error">{apiError}</div>}

        <form onSubmit={handleSubmit} autoComplete="off">
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
                  className={`input ${errors.lastName ? 'input--error' : ''}`}
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  placeholder="Văn A"
                  autoComplete="off"
                />
                {errors.lastName && <span className="form__err">{errors.lastName}</span>}
              </div>
            </div>

            <div className="form__field">
              <label className="form__label">Số điện thoại <span className="required">*</span></label>
              <input
                className={`input ${errors.phone ? 'input--error' : ''}`}
                value={form.phone}
                onChange={(e) => handleChange('phone', formatPhoneInput(e.target.value))}
                inputMode="numeric"
                placeholder="0123-456-789"
                maxLength={13}
                placeholder="0912345678"
                autoComplete="tel"
                inputMode="numeric"
                maxLength={11}
              />
              {errors.phone && <span className="form__err">{errors.phone}</span>}
            </div>
          </div>

          <div className="form__section">
            <div className="form__section-title">Phân công & trạng thái</div>

            {isEdit && hasMultipleRoles(user?.roles) && (
              <div className="form__warning" role="alert">
                User này đang có <b>{user.roles.length} vai trò</b>:{' '}
                {user.roles.map((r) => r.roleName).join(', ')}.
                <br />
                Nếu bạn <b>không thay đổi</b> dropdown Vai trò thì các vai trò hiện tại được giữ nguyên.
                <br />
                Nếu bạn <b>chọn vai trò khác</b>, các vai trò còn lại sẽ bị thay thế.
              </div>
            )}

            <div className="form__row">
              <div className="form__field">
                <label className="form__label">Chi nhánh <span className="required">*</span></label>
                <select
                  className={`input input--select ${errors.branchId ? 'input--error' : ''}`}
                  value={form.branchId}
                  onChange={(e) => handleChange('branchId', e.target.value)}
                >
                  <option value="">-- Chọn chi nhánh --</option>
                  {((isEdit && hasAdminRole(user?.roles)) ||
                    (!isEdit && Number(form.roleId) === ADMIN_ROLE_ID)) && (
                    <option value={ALL_BRANCHES_SENTINEL}>Tất cả chi nhánh (Admin)</option>
                  )}
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
                <p className="form__hint">Không có chức năng xóa tài khoản — chỉ khóa hoặc kích hoạt lại.</p>
              </div>
            )}
          </div>

          {isEdit && user && (
            <div className="form__section form__section--security">
              <div className="form__section-title">Bảo mật tài khoản</div>
              <div className="form__security-actions">
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setShowReset(true)}
                >
                  Đặt lại mật khẩu
                </button>
              </div>
            </div>
          )}

          <div className="admin-user-form-page__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigate(backToList)}
              disabled={loading}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Đang xử lý...' : (isEdit ? 'Lưu thay đổi' : 'Tạo người dùng')}
            </button>
          </div>
        </form>
      </div>

      {showReset && user && (
        <ResetPasswordModal
          user={user}
          onClose={() => setShowReset(false)}
          onSuccess={() => {
            setShowReset(false);
            toast.success('Đã đặt lại mật khẩu');
          }}
        />
      )}
    </div>
  );
}
