import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useExportRequestForm } from '../../hooks/inventory/useExportRequestForm';
import { productApi } from '../../services';
import './ExportRequestFormPage.css';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildItemFromRo(roTask) {
  return {
    rowKey: `r_${roTask.repairTaskId}_${Math.random().toString(36).slice(2, 6)}`,
    productId: roTask.productId,
    productCode: roTask.productCode,
    productName: roTask.productName,
    unit: roTask.unit,
    quantity: roTask.requestedQuantity,
    requestedQuantity: roTask.requestedQuantity,
    currentStock: roTask.currentStock,
  };
}

export default function ExportRequestFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const branchId = user?.branchId;

  const {
    nextCode, codeDate, loadingCode, codeError, refetchCode,
    submitting, submitError, submit,
    repairOrders, loadingRepairOrders, fetchRepairOrders,
    loadRepairOrder, loadingRoDetail,
  } = useExportRequestForm(branchId);

  const [exportDate, setExportDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [selectedRo, setSelectedRo] = useState(null);
  const [items, setItems] = useState([]);
  const [formError, setFormError] = useState('');
  const [roSearchTerm, setRoSearchTerm] = useState('');
  const [showRoPicker, setShowRoPicker] = useState(true);

  // Them phu tung thu cong (khi LSC khong co san task PART)
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Load danh sach RO khi mo form
  useEffect(() => {
    if (showRoPicker) {
      fetchRepairOrders(roSearchTerm);
    }
  }, [showRoPicker, roSearchTerm, fetchRepairOrders]);

  // Tim phu tung khi nhap tu khoa (debounce 300ms)
  useEffect(() => {
    const term = productSearchTerm.trim();
    if (term.length < 2) {
      setProductSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const res = await productApi.searchProductsApi(term);
        const list = Array.isArray(res) ? res : (res?.items || []);
        setProductSearchResults(list.slice(0, 20));
      } catch (_) {
        setProductSearchResults([]);
      } finally {
        setSearchingProducts(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [productSearchTerm]);

  async function handlePickRo(ro) {
    setFormError('');
    if (ro.alreadyExported) {
      setFormError(`Lenh sua chua ${ro.repairOrderCode} da duoc xuat kho truoc do.`);
      return;
    }
    try {
      const detail = await loadRepairOrder(ro.id);
      const builtItems = (detail.items || []).map(buildItemFromRo);
      setSelectedRo({
        id: detail.id,
        repairOrderCode: detail.repairOrderCode,
        serviceOrderCode: detail.serviceOrderCode,
        status: detail.status,
        customerName: detail.customerName,
        vehiclePlate: detail.vehiclePlate,
        teamLeaderName: detail.teamLeaderName,
      });
      setItems(builtItems);
      setShowRoPicker(false);
    } catch (err) {
      setFormError(err.message || 'Khong the tai lenh sua chua');
    }
  }

  function handleChangeRo() {
    setSelectedRo(null);
    setItems([]);
    setShowRoPicker(true);
  }

  function updateItem(rowKey, patch) {
    setItems((prev) => prev.map((it) => (it.rowKey === rowKey ? { ...it, ...patch } : it)));
  }

  function addManualProduct(p) {
    setItems((prev) => {
      // Neu SP da co thi cong don so luong
      const exist = prev.find((it) => it.productId === p.id);
      if (exist) {
        return prev.map((it) => (it.productId === p.id ? { ...it, quantity: Number(exist.quantity || 0) + 1 } : it));
      }
      return [
        ...prev,
        {
          rowKey: `m_${p.id}_${Math.random().toString(36).slice(2, 6)}`,
          productId: p.id,
          productCode: p.code || p.productCode,
          productName: p.name || p.productName,
          unit: p.unit,
          quantity: 1,
          requestedQuantity: 0,
          currentStock: p.stockQuantity ?? p.stock_quantity ?? null,
        },
      ];
    });
    setProductSearchTerm('');
    setProductSearchResults([]);
  }

  function removeItem(rowKey) {
    setItems((prev) => prev.filter((it) => it.rowKey !== rowKey));
  }

  function validate() {
    if (!selectedRo) return 'Vui long chon lenh sua chua';
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
        repairOrderId: selectedRo.id,
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
        {/* Chon lenh sua chua */}
        <div className="er-form__section">
          <h2 className="er-form__section-title">Lenh sua chua (Repair Order)</h2>
          {!selectedRo ? (
            <div className="er-form__so-picker">
              <input
                className="input"
                type="text"
                placeholder="Tim theo ma LSC, ma RO, ten khach, bien so xe..."
                value={roSearchTerm}
                onChange={(e) => setRoSearchTerm(e.target.value)}
              />
              {loadingRepairOrders ? (
                <div className="er-form__hint">Dang tai danh sach LSC...</div>
              ) : repairOrders.length === 0 ? (
                <div className="er-form__hint">Khong co lenh sua chua nao can xuat kho.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Ma LSC</th>
                        <th>Ma RO</th>
                        <th>Khach hang</th>
                        <th>Xe</th>
                        <th>Trang thai</th>
                        <th className="text-right">So PT</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {repairOrders.map((ro) => (
                        <tr key={ro.id}>
                          <td><span className="font-mono">{ro.repairOrderCode}</span></td>
                          <td><span className="font-mono">{ro.serviceOrderCode || '—'}</span></td>
                          <td>{ro.customerName || '—'}</td>
                          <td>{ro.vehiclePlate || '—'}</td>
                          <td>
                            {ro.alreadyExported ? (
                              <span className="badge badge--danger">Da xuat</span>
                            ) : (
                              <span className="badge badge--success">Chua xuat</span>
                            )}
                          </td>
                          <td className="text-right">{ro.partTaskCount ?? 0}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              disabled={ro.alreadyExported}
                              onClick={() => handlePickRo(ro)}
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
                <div><strong>Ma LSC:</strong> <span className="font-mono">{selectedRo.repairOrderCode}</span></div>
                <div><strong>Ma RO:</strong> <span className="font-mono">{selectedRo.serviceOrderCode || '—'}</span></div>
                <div><strong>Khach hang:</strong> {selectedRo.customerName || '—'}</div>
                <div><strong>Xe:</strong> {selectedRo.vehiclePlate || '—'}</div>
                <div><strong>To truong:</strong> {selectedRo.teamLeaderName || '—'}</div>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleChangeRo}>
                Doi phieu khac
              </button>
            </div>
          )}
        </div>

        {/* Thong tin phieu xuat */}
        {selectedRo && (
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
                  Co the dieu chinh so luong, them phu tung phat sinh hoac xoa dong khong can xuat.
                  {loadingRoDetail && ' Dang tai...'}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="er-form__empty">
                  Phieu sua chua khong co phu tung (PART) nao. Ban co the them thu cong ben duoi.
                </p>
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
                        <th style={{ width: 70 }}></th>
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
                            <td>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => removeItem(it.rowKey)}
                                title="Xoa dong nay"
                              >
                                Xoa
                              </button>
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

              {/* Them phu tung thu cong (cho phep tu LSC khong co PART task) */}
              <div className="er-form__add-product">
                <h3 className="er-form__add-title">+ Them phu tung</h3>
                <input
                  className="input"
                  type="text"
                  placeholder="Nhap ma hoac ten phu tung (it nhat 2 ky tu)..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                />
                {searchingProducts && (
                  <div className="er-form__hint">Dang tim...</div>
                )}
                {!searchingProducts && productSearchResults.length > 0 && (
                  <ul className="er-form__product-results">
                    {productSearchResults.map((p) => (
                      <li key={p.id}>
                        <button type="button" className="er-form__product-hit" onClick={() => addManualProduct(p)}>
                          <span className="font-mono">{p.code || p.productCode}</span>
                          <span className="er-form__product-name">{p.name || p.productName}</span>
                          <span className="er-form__product-stock">Ton: {p.stockQuantity ?? p.stock_quantity ?? '—'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!searchingProducts && productSearchTerm.trim().length >= 2 && productSearchResults.length === 0 && (
                  <div className="er-form__hint">Khong tim thay phu tung phu hop.</div>
                )}
              </div>
            </div>
          </>
        )}

        {formError && <div className="er-form__error">{formError}</div>}
        {submitError && <div className="er-form__error">{submitError}</div>}

        {selectedRo && (
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