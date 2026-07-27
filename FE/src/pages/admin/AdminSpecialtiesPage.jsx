import { useEffect, useState } from 'react';
import { adminSpecialtiesApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import PermissionGate from '../../components/PermissionGate';
import './AdminSpecialtiesPage.css';

// ─── Icons ────────────────────────────────────────────────────────────

const IconWrench = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconAlert = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ─── Specialty Form Modal ──────────────────────────────────────────

function SpecialtyFormModal({ specialty, onClose, onSuccess }) {
  const isEdit = Boolean(specialty?.id);
  const [form, setForm] = useState({
    specialtyCode: specialty?.specialtyCode || '',
    specialtyName: specialty?.specialtyName || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.specialtyCode.trim()) { setError('Mã chuyên môn là bắt buộc'); return; }
    if (!form.specialtyName.trim()) { setError('Tên chuyên môn là bắt buộc'); return; }

    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await adminSpecialtiesApi.update(specialty.id, { specialtyName: form.specialtyName.trim() });
      } else {
        await adminSpecialtiesApi.create({ specialtyCode: form.specialtyCode.trim().toUpperCase(), specialtyName: form.specialtyName.trim() });
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu chuyên môn');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="specialty-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="specialty-modal">
        <div className="specialty-modal__header">
          <h2 className="specialty-modal__title">
            {isEdit ? 'Chỉnh sửa chuyên môn' : 'Thêm chuyên môn mới'}
          </h2>
          <button className="specialty-modal__close" onClick={onClose} type="button"><IconX /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="specialty-modal__body">
            <div className="form-group">
              <label>Mã chuyên môn <span>*</span></label>
              <input
                type="text"
                value={form.specialtyCode}
                onChange={(e) => set('specialtyCode', e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                placeholder="VD: ENGINE, BRAKE, ELECTRIC"
                maxLength={30}
                required
                disabled={isEdit}
              />
              <p className="form-hint">Mã hệ thống viết HOA, không dấu. Không đổi được sau khi tạo.</p>
            </div>
            <div className="form-group">
              <label>Tên chuyên môn <span>*</span></label>
              <input
                type="text"
                value={form.specialtyName}
                onChange={(e) => set('specialtyName', e.target.value)}
                placeholder="VD: Sửa máy - Động cơ"
                required
              />
            </div>
            {error && <div style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>}
          </div>
          <div className="specialty-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Hủy</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo chuyên môn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function AdminSpecialtiesPage({ embedded = false } = {}) {
  const toast = useToast();
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editSpecialty, setEditSpecialty] = useState(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const data = await adminSpecialtiesApi.list();
      setSpecialties(data?.items || []);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách chuyên môn');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleToggleStatus(specialty) {
    try {
      await adminSpecialtiesApi.toggleStatus(specialty.id);
      if (specialty.isActive) toast.warning('Đã tắt chuyên môn');
      else toast.success('Đã kích hoạt chuyên môn');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  }

  const createButton = (
    <PermissionGate permission="admin:specialties:create">
      <button className="btn btn--primary" onClick={() => { setEditSpecialty(null); setShowForm(true); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Thêm chuyên môn
      </button>
    </PermissionGate>
  );

  return (
    <div className={`admin-specialties${embedded ? ' admin-specialties--embedded' : ''}`}>
      {!embedded && (
        <div className="admin-specialties__header">
          <div className="admin-specialties__title-block">
            <div className="admin-specialties__title-icon"><IconWrench /></div>
            <div className="admin-specialties__title-group">
              <h1>Chuyên môn</h1>
              <p className="admin-specialties__subtitle">Quản lý chuyên môn của nhân viên kỹ thuật</p>
            </div>
          </div>
          <div className="admin-specialties__actions">
            {createButton}
          </div>
        </div>
      )}

      {embedded && (
        <div className="admin-hub__toolbar">
          {createButton}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="admin-specialties__loading">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span>Đang tải...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="admin-specialties__error">
          <IconAlert />
          <span>{error}</span>
          <button className="btn btn--secondary btn--sm" onClick={loadData}>Thử lại</button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          {specialties.length === 0 ? (
            <div className="admin-specialties__empty">
              <IconWrench />
              <p>Chưa có chuyên môn nào</p>
              <PermissionGate permission="admin:specialties:create">
                <button className="btn btn--primary" onClick={() => setShowForm(true)}>
                  Thêm chuyên môn đầu tiên
                </button>
              </PermissionGate>
            </div>
          ) : (
            <div className="specialties-table-wrapper">
              <table className="specialties-table">
                <thead>
                  <tr>
                    <th className="col--code">Mã</th>
                    <th className="col--name">Tên chuyên môn</th>
                    <th className="col--status">Trạng thái</th>
                    <th className="col--actions">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {specialties.map((s) => (
                    <tr key={s.id} className={s.isActive ? '' : 'row--inactive'}>
                      <td className="specialty-code-cell"><span className="specialty-code">{s.specialtyCode}</span></td>
                      <td className="specialty-name-cell"><span className="specialty-name">{s.specialtyName}</span></td>
                      <td className="specialty-status-cell">
                        <span className={`specialty-status-badge ${s.isActive ? 'specialty-status-badge--active' : 'specialty-status-badge--inactive'}`}>
                          {s.isActive ? 'Hoạt động' : 'Không hoạt động'}
                        </span>
                      </td>
                      <td className="specialty-actions-cell">
                        <div className="specialty-actions">
                          <PermissionGate permission="admin:specialties:update">
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={() => { setEditSpecialty(s); setShowForm(true); }}
                              title="Chỉnh sửa"
                            >
                              <IconEdit /> Sửa
                            </button>
                          </PermissionGate>
                          <PermissionGate
                            permission={s.isActive ? 'admin:specialties:deactivate' : 'admin:specialties:activate'}
                          >
                            <button
                              className={`btn btn--sm ${s.isActive ? 'btn--warning' : 'btn--success-outline'}`}
                              onClick={() => handleToggleStatus(s)}
                              title={s.isActive ? 'Tắt chuyên môn' : 'Kích hoạt chuyên môn'}
                            >
                              {s.isActive ? 'Tắt' : 'Kích hoạt'}
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showForm && (
        <SpecialtyFormModal
          specialty={editSpecialty}
          onClose={() => { setShowForm(false); setEditSpecialty(null); }}
          onSuccess={() => {
            if (editSpecialty) toast.warning('Đã cập nhật chuyên môn');
            else toast.success('Đã tạo chuyên môn mới');
            setShowForm(false);
            setEditSpecialty(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
