import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useInventoryBranch } from './InventoryLayout';
import { useImportRequestForm } from '../../hooks/inventory/useImportRequestForm';
import { getSuppliersApi } from '../../services/supplierApi';
import { PermissionGate } from '../../components/PermissionGate';
import { searchProductsApi } from '../../services/productApi';
import './ImportRequestFormPage.css';

function emptyItem() {
  return {
    rowKey: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId: null,
    productCode: '',
    productName: '',
    unit: '',
    quantity: '',
    searchTerm: '',
    searchResults: [],
    searching: false,
    showDropdown: false,
    error: '',
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ImportRequestFormPage() {
  const navigate = useNavigate();
  const { branchId, loadingBranches, branchError } = useInventoryBranch();

  const {
    nextCode, codeDate, loadingCode, codeError, refetchCode,
    submitting, submitError, submit,
  } = useImportRequestForm(branchId);

  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [importDate, setImportDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoadingSuppliers(true);
    getSuppliersApi({ status: 'active' })
      .then((res) => {
        if (!alive) return;
        setSuppliers(res.items || []);
      })
      .catch(() => {
        if (alive) setSuppliers([]);
      })
      .finally(() => {
        if (alive) setLoadingSuppliers(false);
      });
    return () => { alive = false; };
  }, []);

  // Debounce search phu tung theo rowKey
  const debounceTimers = useState({})[0];

  const handleSearchProduct = useCallback((rowKey, term) => {
    if (debounceTimers[rowKey]) {
      clearTimeout(debounceTimers[rowKey]);
    }
    if (!term || term.trim().length < 2) {
      setItems((prev) => prev.map((it) =>
        it.rowKey === rowKey ? { ...it, searchResults: [], searching: false, showDropdown: false } : it
      ));
      return;
    }
    setItems((prev) => prev.map((it) =>
      it.rowKey === rowKey ? { ...it, searching: true, showDropdown: true } : it
    ));
    debounceTimers[rowKey] = setTimeout(async () => {
      try {
        const res = await searchProductsApi(term.trim(), branchId);
        setItems((prev) => prev.map((it) =>
          it.rowKey === rowKey
            ? { ...it, searchResults: res || [], searching: false }
            : it
        ));
      } catch (err) {
        setItems((prev) => prev.map((it) =>
          it.rowKey === rowKey ? { ...it, searchResults: [], searching: false, error: err.message } : it
        ));
      }
    }, 300);
  }, [branchId]);

  function updateItem(rowKey, patch) {
    setItems((prev) => prev.map((it) => (it.rowKey === rowKey ? { ...it, ...patch } : it)));
  }

  function pickProduct(rowKey, p) {
    updateItem(rowKey, {
      productId: p.id,
      productCode: p.productCode,
      productName: p.productName,
      unit: p.unitName,
      searchTerm: `${p.productCode} - ${p.productName}`,
      searchResults: [],
      showDropdown: false,
      error: '',
    });
  }

  function clearProduct(rowKey) {
    updateItem(rowKey, {
      productId: null,
      productCode: '',
      productName: '',
      unit: '',
      searchTerm: '',
      searchResults: [],
      error: '',
    });
  }

  function addItem() {
    if (items.length >= 50) return;
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(rowKey) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.rowKey !== rowKey));
  }

  function validate() {
    if (!supplierId) return 'Vui lòng chọn nhà cung cấp';
    if (!importDate) return 'Vui lòng chọn ngày nhập';
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      if (!it.productCode) return `Dòng ${i + 1}: chưa chọn phụ tùng`;
      const q = Number(it.quantity);
      if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) {
        return `Dòng ${i + 1}: số lượng phải là số nguyên dương`;
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
        supplierId: supplierId ? Number(supplierId) : null,
        supplierInvoiceNo: supplierInvoiceNo || undefined,
        importDate,
        notes: notes || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          unit: it.unit || undefined,
          quantity: Number(it.quantity),
        })),
      });
      navigate(`/inventory/import-requests/${created.id}`);
    } catch (submitErr) {
      setFormError(submitErr.message || 'Tạo phiếu thất bại');
    }
  }

  const totalQuantity = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0),
    0,
  );

  if (!branchId) {
    return (
      <div className="ir-form__error">
        {loadingBranches ? 'Đang tải danh sách chi nhánh...' : (branchError || 'Vui lòng chọn chi nhánh để tạo phiếu nhập.')}
      </div>
    );
  }

  return (
    <div className="ir-form">
      <div className="ir-form__header">
        <div>
          <h1 className="ir-form__title">Tạo phiếu nhập kho</h1>
          <p className="ir-form__subtitle">
            Mã phiếu sẽ được sinh tự động khi lưu. Phiếu nhập mới sẽ được cập nhật tồn kho ngay sau khi tạo,
            không cần chờ quản lý chi nhánh duyệt.
          </p>
        </div>
        <Link to="/inventory/import-requests" className="btn btn--ghost">
          &laquo; Quay lại
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="ir-form__body">
            <div className="ir-form__info">
          <div className="ir-form__info-row">
            <div className="ir-form__field">
              <label className="ir-form__label">Mã phiếu (sẽ sinh tự động)</label>
              <input
                className="input"
                type="text"
                value={loadingCode ? 'Đang sinh...' : (nextCode || '')}
                readOnly
                placeholder="IRB-{branchId}-{YYYYMMDD}-{seq}"
              />
              {codeError && <div className="ir-form__hint ir-form__hint--error">{codeError}</div>}
              {!loadingCode && !codeError && (
                <div className="ir-form__hint">
                  Ngày sinh mã: <strong>{codeDate || '—'}</strong>
                  &nbsp;
                  <button type="button" className="btn btn--ghost btn--sm" onClick={refetchCode}>
                    Sinh lại
                  </button>
                </div>
              )}
            </div>

            <div className="ir-form__field">
              <label className="ir-form__label">Ngày nhập *</label>
              <input
                className="input"
                type="date"
                value={importDate}
                onChange={(e) => setImportDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="ir-form__info-row">
            <div className="ir-form__field">
              <label className="ir-form__label">Nhà cung cấp *</label>
              <select
                className="input"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                <option value="">
                  {loadingSuppliers ? 'Đang tải danh sách...' : '-- Chọn nhà cung cấp --'}
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplierCode} - {s.supplierName}
                  </option>
                ))}
              </select>
            </div>

            <div className="ir-form__field">
              <label className="ir-form__label">Số hóa đơn NCC</label>
              <input
                className="input"
                type="text"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                placeholder="VD: INV-2026-001"
                maxLength={50}
              />
            </div>
          </div>

          <div className="ir-form__field">
            <label className="ir-form__label">Ghi chú</label>
            <textarea
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ghi chú thêm về phiếu nhập..."
            />
          </div>
        </div>

        <div className="ir-form__items">
          <div className="ir-form__items-header">
            <h2 className="ir-form__items-title">Danh sách phụ tùng</h2>
            <button type="button" className="btn btn--secondary btn--sm" onClick={addItem}>
              + Thêm dòng
            </button>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th style={{ width: '32%' }}>Phụ tùng *</th>
                  <th>Mã phụ tùng</th>
                  <th>Đơn vị</th>
                  <th style={{ width: 130 }}>Số lượng *</th>
                  <th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.rowKey}>
                    <td>{idx + 1}</td>
                    <td style={{ position: 'relative' }}>
                      <input
                        className="input"
                        type="text"
                        value={it.searchTerm}
                        placeholder="Gõ ít nhất 2 ký tự để tìm..."
                        onChange={(e) => {
                          updateItem(it.rowKey, { searchTerm: e.target.value, showDropdown: true });
                          handleSearchProduct(it.rowKey, e.target.value);
                        }}
                        onFocus={() => {
                          if (it.searchResults.length > 0) {
                            updateItem(it.rowKey, { showDropdown: true });
                          }
                        }}
                      />
                      {it.showDropdown && (it.searchResults.length > 0 || it.searching) && (
                        <div className="ir-form__dropdown">
                          {it.searching && <div className="ir-form__dropdown-item">Đang tìm...</div>}
                          {!it.searching && it.searchResults.length === 0 && (
                            <div className="ir-form__dropdown-item">Không có kết quả</div>
                          )}
                          {!it.searching && it.searchResults.map((p) => (
                            <button
                              type="button"
                              key={p.id}
                              className="ir-form__dropdown-item ir-form__dropdown-item--clickable"
                              onClick={() => pickProduct(it.rowKey, p)}
                            >
                              <span className="font-mono">{p.productCode}</span>
                              &nbsp;-&nbsp;{p.productName}
                              <span className="ir-form__dropdown-meta">
                                ({p.unitName})
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="font-mono">{it.productCode || '—'}</span>
                    </td>
                    <td>{it.unit || '—'}</td>
                    <td>
                      <input
                        className="input"
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
                        disabled={items.length <= 1}
                        title="Xóa dòng"
                      >
                        X
                      </button>
                      {it.productCode && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => clearProduct(it.rowKey)}
                          title="Bỏ chọn"
                        >
                          ⟲
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="text-right"><strong>Tổng số lượng:</strong></td>
                  <td className="text-right"><strong>{totalQuantity}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {formError && <div className="ir-form__error">{formError}</div>}
        {submitError && <div className="ir-form__error">{submitError}</div>}

        <div className="ir-form__actions">
          <Link to="/inventory/import-requests" className="btn btn--ghost">
            Hủy
          </Link>
          <PermissionGate permission="import_requests:create">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || loadingCode || !nextCode}
            >
              {submitting ? 'Đang lưu...' : 'Tạo phiếu nhập'}
            </button>
          </PermissionGate>
        </div>
      </form>
    </div>
  );
}