import { useEffect, useState } from 'react';
import { adminVehicleBrandsApi } from '../../services/adminApi';
import { useToast } from '../../components/common/ToastContext';
import './AdminShared.css';
import './AdminSpecialtiesPage.css';

export default function AdminVehicleBrandsPage({ embedded = false } = {}) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    brandName: '',
    warrantyYears: '5',
    warrantyKm: '100000',
  });
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const data = await adminVehicleBrandsApi.list();
      setItems(data?.items || []);
    } catch (err) {
      setError(err?.message || 'Không tải được danh sách hãng xe');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setEditItem(null);
    setForm({
      brandName: '',
      warrantyYears: '5',
      warrantyKm: '100000',
    });
    setShowForm(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      brandName: item.brandName || '',
      warrantyYears: String(item.warrantyYears ?? 5),
      warrantyKm: String(item.warrantyKm ?? 100000),
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.brandName.trim()) {
      toast.error('Tên hãng xe là bắt buộc');
      return;
    }
    const years = Number(form.warrantyYears);
    const km = Number(form.warrantyKm);
    if (!Number.isFinite(years) || years < 0 || years > 100) {
      toast.error('Số năm bảo hành phải từ 0 đến 100');
      return;
    }
    if (!Number.isFinite(km) || km < 0) {
      toast.error('Số km bảo hành phải >= 0');
      return;
    }
    const payload = {
      brandName: form.brandName.trim(),
      warrantyYears: years,
      warrantyKm: km,
    };
    setSaving(true);
    try {
      if (editItem) {
        await adminVehicleBrandsApi.update(editItem.id, payload);
        toast.success('Đã cập nhật hãng xe');
      } else {
        await adminVehicleBrandsApi.create(payload);
        toast.success('Đã thêm hãng xe');
      }
      setShowForm(false);
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item) {
    try {
      await adminVehicleBrandsApi.toggleStatus(item.id);
      toast.success(item.isActive ? 'Đã tắt hãng xe' : 'Đã kích hoạt hãng xe');
      await loadData();
    } catch (err) {
      toast.error(err?.message || 'Không đổi được trạng thái');
    }
  }

  const createButton = (
    <button type="button" className="btn btn--primary" onClick={openCreate}>+ Thêm hãng</button>
  );

  return (
    <div className={`admin-page admin-specialties${embedded ? ' admin-specialties--embedded' : ''}`}>
      {!embedded && (
        <div className="admin-page__header">
          <div className="admin-page__title-block">
            <div className="admin-page__title-icon">🚗</div>
            <div className="admin-page__title-group">
              <h1>Hãng xe</h1>
              <p className="admin-page__subtitle">Danh mục hãng xe dùng khi tiếp nhận yêu cầu dịch vụ</p>
            </div>
          </div>
          <div className="admin-page__actions">
            {createButton}
          </div>
        </div>
      )}

      {embedded && (
        <div className="admin-hub__toolbar">
          {createButton}
        </div>
      )}

      {loading && <div className="admin-page__loading">Đang tải...</div>}
      {error && !loading && <div className="admin-page__error">{error}</div>}

      {!loading && !error && (
        <div className="specialties-table-wrapper brands-table-wrap">
          <table className="specialties-table brands-table">
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="brands-col brands-col--stt">STT</th>
                <th className="brands-col brands-col--code">Mã</th>
                <th className="brands-col brands-col--name">Tên hãng</th>
                <th className="brands-col brands-col--num">BH (năm)</th>
                <th className="brands-col brands-col--num">BH (km)</th>
                <th className="brands-col brands-col--status">Trạng thái</th>
                <th className="brands-col brands-col--actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className={item.isActive ? '' : 'row--inactive'}>
                  <td className="brands-col brands-col--stt">{idx + 1}</td>
                  <td className="brands-col brands-col--code">
                    <code className="brands-code">{item.brandCode || '—'}</code>
                  </td>
                  <td className="brands-col brands-col--name">
                    <span className="specialty-name">{item.brandName}</span>
                  </td>
                  <td className="brands-col brands-col--num">{item.warrantyYears ?? '—'}</td>
                  <td className="brands-col brands-col--num">
                    {item.warrantyKm != null ? Number(item.warrantyKm).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="brands-col brands-col--status">
                    <span className={`specialty-status-badge ${item.isActive ? 'specialty-status-badge--active' : 'specialty-status-badge--inactive'}`}>
                      {item.isActive ? 'Hoạt động' : 'Tắt'}
                    </span>
                  </td>
                  <td className="brands-col brands-col--actions">
                    <div className="specialty-actions">
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => openEdit(item)}>Sửa</button>
                      <button
                        type="button"
                        className={`btn btn--sm ${item.isActive ? 'btn--warning' : 'btn--success-outline'}`}
                        onClick={() => handleToggle(item)}
                      >
                        {item.isActive ? 'Tắt' : 'Bật'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Chưa có hãng xe</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="specialty-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="specialty-modal">
            <div className="specialty-modal__header">
              <h2 className="specialty-modal__title">{editItem ? 'Sửa hãng xe' : 'Thêm hãng xe'}</h2>
              <button type="button" className="specialty-modal__close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="specialty-modal__body">
                <div className="form-group">
                  <label>Tên hãng</label>
                  <input className="form-input" value={form.brandName} onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Bảo hành (năm)</label>
                  <input className="form-input" type="number" min="0" value={form.warrantyYears} onChange={(e) => setForm((f) => ({ ...f, warrantyYears: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Bảo hành (km)</label>
                  <input className="form-input" type="number" min="0" value={form.warrantyKm} onChange={(e) => setForm((f) => ({ ...f, warrantyKm: e.target.value }))} />
                </div>
              </div>
              <div className="specialty-modal__footer">
                <button type="button" className="btn btn--secondary" onClick={() => setShowForm(false)}>Hủy</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
