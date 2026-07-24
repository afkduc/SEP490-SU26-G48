import { useEffect, useState } from 'react';
import { adminBranchesApi, adminRolesApi, adminUsersApi } from '../../../services/adminApi';
import './UserFormModal.css';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
  { value: 'locked', label: 'Bị khóa' },
];

/**
 * Sentinel value gui tu FE -> BE de yeu cau set branch_id = NULL (quan ly tat ca chi nhanh).
 * BE AdminUserService.updateUser se nhan gia tri nay va chuyen thanh NULL.
 */
const ALL_BRANCHES_SENTINEL = '__ALL__';

/**
 * Role Admin id (hardcoded theo DB seed hien tai).
 * Chi user co role Admin moi duoc chon "Tat ca chi nhanh".
 * TODO: thay bang role check qua permission service khi san sang.
 */
const ADMIN_ROLE_ID = 7;

/**
 * Kiem tra role set co chua Admin hay khong.
 */
function hasAdminRole(userRoles) {
  if (!Array.isArray(userRoles)) return false;
  return userRoles.some((r) => {
    const id = typeof r === 'object' && r !== null ? r.roleId : r;
    return Number(id) === ADMIN_ROLE_ID;
  });
}

/**
 * Lay roleId tu user.roles (da hoac chua fetch roles list).
 *
 * Tra ve:
 *   - roleId neu user chi co 1 role (normal case)
 *   - '' neu user co nhieu role (FE phai canh bao admin -> dung modal rieng AssignRoleModal)
 *   - '' neu user khong co role nao
 *
 * @param {Array} userRoles - roles array tu user object [{roleId, roleName}, ...]
 * @param {Array} allRoles  - roles tu API dropdown
 * @returns {string} roleId hoac ''
 */
function resolveRoleId(userRoles, allRoles) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return '';
  const first = userRoles[0];

  // Backend moi: { roleId, roleName }
  let resolvedId = '';
  if (typeof first === 'object' && first !== null) {
    resolvedId = first.roleId !== undefined && first.roleId !== null
      ? String(first.roleId)
      : '';
  } else if (typeof first === 'string') {
    // Backend cu: ['Admin', ...] -> map ten -> id
    const match = allRoles.find((r) => r.roleName === first || String(r.id) === first);
    resolvedId = match ? String(match.id) : '';
  }

  // Neu user co >= 2 role -> tra ve '' de form.roleId bi empty.
  // Caller se hien thi canh bao: "User nay co N vai tro, hay dung modal Phan quyen rieng".
  // Ly do: backend updateUser voi roleId != undefined se DELETE toan bo roles cu va
  // INSERT 1 role moi -> MAT TOAN BO vai tro khac (data loss nghiem trong).
  return resolvedId;
}

/**
 * Kiem tra user co nhieu role khong (de canh bao trong UI).
 */
function hasMultipleRoles(userRoles) {
  return Array.isArray(userRoles) && userRoles.length >= 2;
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
    scopeAllBranches: false,
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

    // Phan biet user "all branches" (co row trong user_branches) vs user 1 branch
    // - assignedBranchIds tu BE co nhieu hon 1 row, hoac user.branchId null -> ALL
    // - assignedBranchIds co 1 row -> set dropdown theo row do
    const isAllBranches = Array.isArray(user.assignedBranchIds)
      ? user.assignedBranchIds.length > 0
      : (user.branchId === null || user.branchId === undefined);
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
      phone: user.phone || '',
      branchId: branchIdValue,
      roleId: resolvedRoleId,
      status: user.status || 'active',
      scopeAllBranches: isAllBranches,
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
    if (!form.branchId) errs.branchId = 'Chi nhánh là bắt buộc (hoặc chọn "Tất cả chi nhánh")';
    // Bug #10: Khi user co nhieu vai tro va admin KHONG thay doi dropdown
    // -> form.roleId se empty (resolveRoleId returns '' for first multi-role).
    // Tranh block submit neu admin khong thay vai tro.
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
        // Bug #10 (data loss): neu user co nhieu vai tro va admin KHONG doi
        // dropdown role -> KHONG gui roleId (undefined) de BE khong DELETE + INSERT.
        // Neu admin doi dropdown -> gui roleId moi (BE se DELETE all + INSERT moi
        // -> mat vai tro phu, nhan roi qua warning).
        const shouldSendRoleId =
          form.roleId && form.roleId !== '';
        const payload = {
          userId: user.id,
          firstName: form.firstName?.trim() || user.firstName || '',
          lastName: form.lastName?.trim() || user.lastName || '',
          email: form.email?.trim() || user.email,
          phone: form.phone?.trim() || undefined,
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
      } else {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim() || form.name.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || undefined,
          roleId: Number(form.roleId),
        };
        if (form.scopeAllBranches) {
          payload.scopeAllBranches = true;
          payload.branchId = null;
        } else {
          payload.branchId = Number(form.branchId);
        }
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
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Khi chon chi nhanh -> tu dong set scopeAllBranches
      if (field === 'branchId') {
        next.scopeAllBranches = value === ALL_BRANCHES_SENTINEL;
      }
      return next;
    });
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

              {/* Canh bao khi user co >=2 vai tro (de tranh data loss).
                  Bug cu: resolveRoleId chi lay role[0], FE gui 1 role duy nhat ->
                  BE AdminUserRepositoryImpl.updateUser DELETE all + INSERT 1 ->
                  mat toan bo vai tro khac.

                  Fix hien tai:
                  - Neu admin KHONG doi dropdown vai tro -> FE bo qua field roleId
                    trong payload -> BE giữ nguyên toàn bộ vai tro.
                  - Neu admin DOI dropdown -> BE sẽ DELETE các vai trò khác.
                    Admin phải dùng modal Phân quyền riêng để quản lý nhiều vai trò. */}
              {isEdit && hasMultipleRoles(user?.roles) && (
                <div
                  className="form__warning"
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    padding: '10px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    marginBottom: 12,
                    lineHeight: 1.5,
                  }}
                  role="alert"
                >
                  ⚠️ User này đang có <b>{user.roles.length} vai trò</b>:{' '}
                  {user.roles.map((r) => r.roleName).join(', ')}.
                  <br />
                  Nếu bạn <b>không thay đổi</b> dropdown Vai trò bên dưới thì các
                  vai trò hiện tại được giữ nguyên.
                  <br />
                  Nếu bạn <b>chọn vai trò khác</b>, các vai trò còn lại sẽ bị
                  xóa — hãy dùng modal <b>Phân quyền</b> riêng để quản lý.
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
                    {/* Option "Tat ca chi nhanh" chi hien thi khi user co role Admin
                        (edit mode: user dang co role Admin) hoac role dang chon la Admin
                        (create mode: admin form chon role Admin). */}
                    {((isEdit && hasAdminRole(user?.roles)) ||
                      (!isEdit && Number(form.roleId) === ADMIN_ROLE_ID)) && (
                      <option value={ALL_BRANCHES_SENTINEL}>Tất cả chi nhánh (Admin)</option>
                    )}
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.branchName}</option>
                    ))}
                  </select>
                  {form.branchId === ALL_BRANCHES_SENTINEL && (
                    <span style={{ fontSize: 12, color: '#2563eb', marginTop: 4 }}>
                      Backend sẽ tự động gom tất cả chi nhánh đang hoạt động cho user này
                    </span>
                  )}
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
