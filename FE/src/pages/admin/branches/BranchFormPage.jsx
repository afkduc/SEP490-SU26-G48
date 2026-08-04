import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminBranchesApi } from '../../../services/adminApi';
import { useToast } from '../../../components/common/ToastContext';
import { EMAIL_HINT, isValidEmail, isValidPhone } from '../../../utils/validation';
import '../AdminBranchesPage.css';
import './BranchPages.css';

export default function BranchFormPage({ mode: modeProp }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = modeProp === 'edit' || Boolean(id);

  const [bootLoading, setBootLoading] = useState(isEdit);
  const [bootError, setBootError] = useState('');
  const [managerCandidates, setManagerCandidates] = useState([]);
  const [form, setForm] = useState({
    branchCode: '',
    branchName: '',
    address: '',
    phone: '',
    email: '',
    managerId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const candidatesRes = await adminBranchesApi.getManagerCandidates();
        if (cancelled) return;
        const { assigned = [], unassigned = [] } = candidatesRes || {};
        setManagerCandidates([...assigned, ...unassigned]);
      } catch (_) {
        /* ignore */
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
    (async () => {
      try {
        const branch = await adminBranchesApi.getDetail(id);
        if (cancelled) return;
        setForm({
          branchCode: branch?.branchCode || '',
          branchName: branch?.branchName || '',
          address: branch?.address || '',
          phone: branch?.phone || '',
          email: (branch?.email || branch?.managerEmail || '').trim(),
          managerId: branch?.managerId || '',
        });
      } catch (err) {
        if (!cancelled) setBootError(err.message || 'Không tải được chi nhánh');
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, id]);

  function set(key, value) {
    setError('');
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleManagerChange(managerId) {
    const selected = managerCandidates.find((m) => String(m.id) === String(managerId));
    setError('');
    setForm((f) => ({
      ...f,
      managerId,
      // Đổi / bỏ quản lý → cập nhật email theo tài khoản đó (vẫn cho sửa tay sau)
      email: selected?.email?.trim() || '',
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.branchName.trim()) {
      setError('Tên chi nhánh là bắt buộc');
      return;
    }
    if (!isEdit && !form.branchCode.trim()) {
      setError('Mã chi nhánh là bắt buộc');
      return;
    }
    const phone = form.phone.replace(/\D/g, '');
    const email = form.email.trim();
    if (phone && !isValidPhone(phone)) {
      setError('Số điện thoại phải bắt đầu bằng 0, 10-11 chữ số');
      return;
    }
    if (email && !isValidEmail(email)) {
      setError(EMAIL_HINT);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        branchName: form.branchName.trim(),
        address: form.address.trim() || undefined,
        phone: phone || undefined,
        email: email || undefined,
        managerId: form.managerId ? Number(form.managerId) : null,
      };
      if (!isEdit) {
        payload.branchCode = form.branchCode.trim();
      }

      if (isEdit) {
        await adminBranchesApi.update(id, payload);
        toast.success('Cập nhật chi nhánh thành công');
        navigate(`/admin/catalog/branches/${id}`);
      } else {
        const created = await adminBranchesApi.create(payload);
        toast.success('Tạo chi nhánh mới thành công');
        const newId = created?.id;
        navigate(newId ? `/admin/catalog/branches/${newId}` : '/admin/catalog');
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu chi nhánh');
    } finally {
      setSaving(false);
    }
  }

  if (bootLoading) {
    return <div className="admin-page branch-page"><div className="branch-page__state">Đang tải...</div></div>;
  }

  if (bootError) {
    return (
      <div className="admin-page branch-page">
        <div className="branch-page__state branch-page__state--error">{bootError}</div>
        <Link to="/admin/catalog" className="btn btn--ghost">Quay lại danh mục</Link>
      </div>
    );
  }

  return (
    <div className="admin-page branch-page">
      <div className="admin-page__header">
        <div className="admin-page__title-block">
          <button
            type="button"
            className="branch-page__back"
            onClick={() => navigate(isEdit ? `/admin/catalog/branches/${id}` : '/admin/catalog')}
          >
            ← Quay lại
          </button>
          <div className="admin-page__title-group">
            <h1>{isEdit ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh mới'}</h1>
          </div>
        </div>
      </div>

      <form className="branch-page__card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Mã chi nhánh <span>*</span></label>
          <input
            type="text"
            value={form.branchCode}
            onChange={(e) => set('branchCode', e.target.value)}
            placeholder="VD: HN, HCM, DNA"
            maxLength={20}
            required={!isEdit}
            disabled={isEdit}
          />
        </div>

        <div className="form-group">
          <label>Tên chi nhánh <span>*</span></label>
          <input
            type="text"
            value={form.branchName}
            onChange={(e) => set('branchName', e.target.value)}
            placeholder="VD: AutoGara Hà Nội"
            required
          />
        </div>

        <div className="form-group">
          <label>Địa chỉ</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="VD: 123 Nguyễn Trãi, Thanh Xuân, Hà Nội"
          />
        </div>

        <div className="form-group">
          <label>Quản lý chi nhánh</label>
          <select value={form.managerId} onChange={(e) => handleManagerChange(e.target.value)}>
            <option value="">— Chưa chọn —</option>
            {managerCandidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName} {m.branchName ? `(Đang ở ${m.branchName})` : '(Chưa có chi nhánh)'}
              </option>
            ))}
          </select>
        </div>

        <div className="branch-page__row">
          <div className="form-group">
            <label>Số điện thoại</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="VD: 02433331111"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="VD: hn@autogara.vn"
            />
          </div>
        </div>

        {error && <div className="branch-page__error">{error}</div>}

        <div className="branch-page__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate(isEdit ? `/admin/catalog/branches/${id}` : '/admin/catalog')}
            disabled={saving}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo chi nhánh'}
          </button>
        </div>
      </form>
    </div>
  );
}
