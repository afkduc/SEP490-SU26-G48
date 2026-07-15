import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useExportRequestForm } from '../../hooks/inventory/useExportRequestForm';
import './ExportRequestFormPage.css';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildItemFromSo(soItem) {
  return {
    rowKey: `r_${soItem.serviceOrderItemId}_${Math.random().toString(36).slice(2, 6)}`,
    productId: soItem.productId,
    productCode: soItem.productCode,
    productName: soItem.productName,
    unit: soItem.unit,
    quantity: soItem.requestedQuantity,
    requestedQuantity: soItem.requestedQuantity,
    currentStock: soItem.currentStock,
  };
}

export default function ExportRequestFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    nextCode, codeDate, loadingCode, codeError, refetchCode,
    submitting, submitError, submit,
    serviceOrders, loadingServiceOrders, fetchServiceOrders,
    loadServiceOrder, loadingSoDetail,
  } = useExportRequestForm(branchId);

  const [exportDate, setExportDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [selectedSo, setSelectedSo] = useState(null);
  const [items, setItems] = useState([]);
  const [formError, setFormError] = useState('');
  const [soSearchTerm, setSoSearchTerm] = useState('');
  const [showSoPicker, setShowSoPicker] = useState(true);

  // Load danh sach SO khi mo form
  useEffect(() => {
    if (showSoPicker) {
      fetchServiceOrders(soSearchTerm);
    }
  }, [showSoPicker, soSearchTerm, fetchServiceOrders]);

  async function handlePickSo(so) {
    setFormError('');
    if (so.alreadyExported) {
      setFormError(`Phieu sua chua ${so.orderCode} da duoc xuat kho truoc do.`);
      return;
    }
    try {
      const detail = await loadServiceOrder(so.id);
      const builtItems = (detail.items || []).map(buildItemFromSo);
      setSelectedSo({
        id: detail.id,
        orderCode: detail.orderCode,
        status: detail.status,
        customerName: detail.customerName,
        vehiclePlate: detail.vehiclePlate,
        advisorName: detail.advisorName,
      });
      setItems(builtItems);
      setShowSoPicker(false);
    } catch (err) {
      setFormError(err.message || 'Khong the tai phieu sua chua');
    }
  }

  function handleChangeSo() {
    setSelectedSo(null);
    setItems([]);
    setShowSoPicker(true);
  }

  function updateItem(rowKey, patch) {
    setItems((prev) => prev.map((it) => (it.rowKey === rowKey ? { ...it, ...patch } : it)));
  }

  function validate() {
    if (!selectedSo) return 'Vui long chon phieu sua chua';
    if (!exportDate) return 'Vui long chon ngay xuat';
    if (items.length === 0) return 'Phieu xuat phai co it nhat 1 dong phu tung';
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const q = Number(it.quantity);
      if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) {
        return `Dong ${i + 1}: so luong phai la so nguyen duong`;
      }
      if (it.currentStock != null && q > it.currentStock) {
        return `Dong ${i + 1}: ton kho chi con ${it.currentStock} (can xuat ${q})`;
      }
    }
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    try {
      const created = await submit({
        serviceOrderId: selectedSo.id,
        exportDate,
        notes: notes || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          unit: it.unit || undefined,
          quantity: Number(it.quantity),
        })),
      });
      navigate(`/inventory/export-requests/${created.id}`);
    } catch (submitErr) {
      setFormError(submitErr.message || 'Tao phieu xuat that bai');
    }
  }

  const totalQuantity = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0),
    0,
  );

  return (
    <div className="er-form">
      <div className="er-form__header">
        <div>
          <h1 className="er-form__title">Tao phieu xuat kho</h1>
          <p className="er-form__subtitle">
            Chon phieu sua chua (Service Order) can xuat phu tung, dieu chinh so luong va luu.
            Ton kho se bi tru ngay khi tao phieu.
          </p>
        </div>
        <Link to="/inventory/export-requests" className="btn btn--ghost">
          &laquo; Quay lai
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="er-form__body">
        {/* Chon phieu sua chua */}
        <div className="er-form__section">
          <h2 className="er-form__section-title">Phieu sua chua (Service Order)</h2>
          {!selectedSo ? (
            <div className="er-form__so-picker">
              <input
                className="input"
                type="text"
                placeholder="Tim theo ma SO, ten khach, bien so xe..."
                value={soSearchTerm}
                onChange={(e) => setSoSearchTerm(e.target.value)}
              />
              {loadingServiceOrders ? (
                <div className="er-form__hint">Dang tai danh sach SO...</div>
              ) : serviceOrders.length === 0 ? (
                <div className="er-form__hint">Khong co phieu sua chua nao can xuat kho.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Ma SO</th>
                        <th>Khach hang</th>
                        <th>Xe</th>
                        <th>Trang thai</th>
                        <th className="text-right">So PT</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceOrders.map((so) => (
                        <tr key={so.id}>
                          <td><span className="font-mono">{so.orderCode}</span></td>
                          <td>{so.customerName || '—'}</td>
                          <td>{so.vehiclePlate || '—'}</td>
                          <td>
                            {so.alreadyExported ? (
                              <span className="badge badge--danger">Da xuat</span>
                            ) : (
                              <span className="badge badge--success">Chua xuat</span>
                            )}
                          </td>
                          <td className="text-right">{so.partItemCount ?? 0}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              disabled={so.alreadyExported}
                              onClick={() => handlePickSo(so)}
                            >
                              Chon
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="er-form__so-summary">
              <div className="er-form__info-grid">
                <div><strong>Ma SO:</strong> <span className="font-mono">{selectedSo.orderCode}</span></div>
                <div><strong>Khach hang:</strong> {selectedSo.customerName || '—'}</div>
                <div><strong>Xe:</strong> {selectedSo.vehiclePlate || '—'}</div>
                <div><strong>Tu van:</strong> {selectedSo.advisorName || '—'}</div>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleChangeSo}>
                Doi phieu khac
              </button>
            </div>
          )}
        </div>

        {/* Thong tin phieu xuat */}
        {selectedSo && (
          <>
            <div className="er-form__info">
              <div className="er-form__info-row">
                <div className="er-form__field">
                  <label className="er-form__label">Ma phieu (se sinh tu dong)</label>
                  <input
                    className="input"
                    type="text"
                    value={loadingCode ? 'Dang sinh...' : (nextCode || '')}
                    readOnly
                    placeholder="EXB-{branchId}-{YYYYMMDD}-{seq}"
                  />
                  {codeError && <div className="er-form__hint er-form__hint--error">{codeError}</div>}
                  {!loadingCode && !codeError && (
                    <div className="er-form__hint">
                      Ngay sinh ma: <strong>{codeDate || '—'}</strong>
                      &nbsp;
                      <button type="button" className="btn btn--ghost btn--sm" onClick={refetchCode}>
                        Sinh lai
                      </button>
                    </div>
                  )}
                </div>

                <div className="er-form__field">
                  <label className="er-form__label">Ngay xuat *</label>
                  <input
                    className="input"
                    type="date"
                    value={exportDate}
                    onChange={(e) => setExportDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="er-form__field">
                <label className="er-form__label">Ghi chu</label>
                <textarea
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Ghi chu them ve phieu xuat..."
                />
              </div>
            </div>

            <div className="er-form__items">
              <div className="er-form__items-header">
                <h2 className="er-form__items-title">Danh sach phu tung xuat</h2>
                <span className="er-form__hint">
                  Co the dieu chinh so luong (vi du xuat khong het hoac them phu tung phat sinh).
                  {loadingSoDetail && ' Dang tai...'}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="er-form__empty">Phieu sua chua khong co phu tung (PART) nao.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Ma phu tung</th>
                        <th>Ten phu tung</th>
                        <th>Don vi</th>
                        <th className="text-right" style={{ width: 100 }}>Yeu cau</th>
                        <th className="text-right" style={{ width: 100 }}>Ton kho</th>
                        <th style={{ width: 130 }}>Xuat *</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const overStock = it.currentStock != null && Number(it.quantity) > it.currentStock;
                        return (
                          <tr key={it.rowKey}>
                            <td>{idx + 1}</td>
                            <td><span className="font-mono">{it.productCode}</span></td>
                            <td>{it.productName}</td>
                            <td>{it.unit || '—'}</td>
                            <td className="text-right">{it.requestedQuantity ?? '—'}</td>
                            <td className="text-right">
                              <span className={overStock ? 'er-form__stock--low' : ''}>
                                {it.currentStock ?? '—'}
                              </span>
                            </td>
                            <td>
                              <input
                                className={`input ${overStock ? 'er-form__input--error' : ''}`}
                                type="number"
                                min={1}
                                step={1}
                                value={it.quantity}
                                onChange={(e) => updateItem(it.rowKey, { quantity: e.target.value })}
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6} className="text-right"><strong>Tong so luong:</strong></td>
                        <td className="text-right"><strong>{totalQuantity}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {formError && <div className="er-form__error">{formError}</div>}
        {submitError && <div className="er-form__error">{submitError}</div>}

        {selectedSo && (
          <div className="er-form__actions">
            <Link to="/inventory/export-requests" className="btn btn--ghost">
              Huy
            </Link>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || loadingCode || !nextCode || items.length === 0}
            >
              {submitting ? 'Dang luu...' : 'Tao phieu xuat'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}