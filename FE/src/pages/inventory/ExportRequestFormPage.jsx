import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useInventoryBranch } from './InventoryLayout';
import { useExportRequestForm } from '../../hooks/inventory/useExportRequestForm';
import { PermissionGate } from '../../components/PermissionGate';
import SignaturePad from '../repairsettlement/SignaturePad';
import './ExportRequestFormPage.css';

// Trang thai 1 dong phu tung, tinh tu du lieu server tra ve:
//   pendingQuantity > 0 -> con phai xuat. Lan dau (chua xuat gi) la "Cần xuất",
//                          da tung xuat roi thi la "Xuất thêm" (hien do).
//   pendingQuantity < 0 -> CVDV da bot phu tung sau khi da xuat -> "Trả hàng".
//   pendingQuantity = 0 -> xong, khong con gi de lam.
// Thieu ton kho thi KHONG cho tick, chi bao "Tồn kho không đủ".
function lineState(item, slipExportedBefore) {
  const pending = Number(item.pendingQuantity) || 0;
  const exported = Number(item.exportedQuantity) || 0;
  const unit = item.unit || '';

  if (pending === 0) {
    return { kind: 'done', label: 'Đã xuất đủ', canTick: false, danger: false };
  }
  if (pending < 0) {
    return { kind: 'return', label: `Trả hàng: ${Math.abs(pending)} ${unit}`.trim(), canTick: true, danger: true };
  }
  if (!item.enoughStock) {
    return { kind: 'no_stock', label: 'Tồn kho không đủ', canTick: false, danger: true };
  }
  if (slipExportedBefore) {
    // Da xuat truoc do roi ma con phat sinh -> canh bao do. Phu tung da xuat
    // lan truoc thi ghi ro so luong xuat them; phu tung moi thi chi ghi
    // "Xuất thêm" (khong co so cu de so sanh).
    return {
      kind: 'export_more',
      label: exported > 0 ? `Xuất thêm: ${pending} ${unit}`.trim() : 'Xuất thêm',
      canTick: true,
      danger: true,
    };
  }
  return { kind: 'first', label: `Cần xuất: ${pending} ${unit}`.trim(), canTick: true, danger: false };
}

export default function ExportRequestFormPage() {
  const navigate = useNavigate();
  const { branchId, loadingBranches, branchError } = useInventoryBranch();

  const {
    submitting, submitError, submit,
    repairOrders, loadingRepairOrders, fetchRepairOrders,
    technicians, loadingTechnicians,
    loadRepairOrder, loadingRoDetail,
  } = useExportRequestForm(branchId);

  const [receivedBy, setReceivedBy] = useState('');
  const [receivedByName, setReceivedByName] = useState('');
  const [technicianSearchTerm, setTechnicianSearchTerm] = useState('');
  const [selectedRo, setSelectedRo] = useState(null);
  const [items, setItems] = useState([]);
  const [tickedIds, setTickedIds] = useState(() => new Set());
  const [formError, setFormError] = useState('');
  const [roSearchTerm, setRoSearchTerm] = useState('');

  // Chu ky cua chinh nguoi lay (tho) xac nhan da nhan phu tung - giong het
  // co che khach hang ky tren phieu quyet toan (SignaturePad dung chung).
  const signaturePadRef = useRef(null);
  const [signatureEmpty, setSignatureEmpty] = useState(true);

  const visibleTechnicians = (() => {
    const term = technicianSearchTerm.trim().toLowerCase();
    if (!term) return [];
    return technicians.filter((t) =>
      t.fullName.toLowerCase().includes(term)
      || (t.employeeId || '').toLowerCase().includes(term));
  })();

  function handlePickTechnician(t) {
    setReceivedBy(String(t.id));
    setReceivedByName(`${t.employeeId ? `${t.employeeId} - ` : ''}${t.fullName}`);
    setTechnicianSearchTerm('');
  }

  function handleChangeTechnician() {
    setReceivedBy('');
    setReceivedByName('');
  }

  // Danh sach RO CHI hien khi nguoi dung go dung tu khoa tim kiem (>= 2 ky
  // tu) - khong tu load toan bo danh sach luc vao trang, tranh lo het cac
  // RO dang cho xuat kho cua chi nhanh cho bat ky ai mo trang nay.
  useEffect(() => {
    const term = roSearchTerm.trim();
    if (term.length < 2) return;
    const handle = setTimeout(() => {
      fetchRepairOrders(term);
    }, 300);
    return () => clearTimeout(handle);
  }, [roSearchTerm, fetchRepairOrders]);

  const visibleRepairOrders = roSearchTerm.trim().length < 2 ? [] : repairOrders;

  async function loadRoState(roId) {
    const detail = await loadRepairOrder(roId);
    setSelectedRo({
      id: detail.id,
      repairOrderCode: detail.repairOrderCode,
      status: detail.status,
      customerName: detail.customerName,
      vehiclePlate: detail.vehiclePlate,
      teamLeaderName: detail.teamLeaderName,
      exportRequestId: detail.exportRequestId,
      locked: detail.locked,
    });
    setItems(detail.items || []);
    // KHONG tick san dong nao: tick la hanh dong xac nhan chu dong cua NV Kho
    // ("da lay dong nay"), de san thi ky xac nhan mat y nghia.
    setTickedIds(new Set());
    return detail;
  }

  async function handlePickRo(ro) {
    setFormError('');
    try {
      await loadRoState(ro.id);
      setRoSearchTerm('');
    } catch (err) {
      setFormError(err.message || 'Không thể tải lệnh sửa chữa');
    }
  }

  function toggleTick(productId) {
    setTickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function handleChangeRo() {
    setSelectedRo(null);
    setItems([]);
    setTickedIds(new Set());
    signaturePadRef.current?.clear();
  }

  function validate() {
    if (!selectedRo) return 'Vui lòng chọn lệnh sửa chữa';
    if (selectedRo.locked) return 'Lệnh sửa chữa đã chốt, không thể xuất/trả phụ tùng nữa';
    if (tickableCount === 0) return 'Không có dòng nào cần xuất hoặc trả';
    // Phai tich DU tat ca cac dong con viec - khong cho luu phieu nua voi.
    // (Dong thieu ton kho khong tick duoc nen khong tinh vao day.)
    if (tickedIds.size < tickableCount) {
      return `Còn ${tickableCount - tickedIds.size} dòng chưa tích — phải tích đủ tất cả các dòng mới lưu được phiếu`;
    }
    if (!receivedBy) return 'Vui lòng chọn người lấy (thợ nhận phụ tùng)';
    if (signaturePadRef.current?.isEmpty() ?? true) return 'Vui lòng ký xác nhận đã lấy phụ tùng';
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
      // Chi gui productIds duoc tick - so luong do server tu tinh lai.
      const saved = await submit({
        repairOrderId: selectedRo.id,
        receivedBy: Number(receivedBy),
        receivedSignatureData: signaturePadRef.current.toDataURL(),
        productIds: [...tickedIds],
      });
      navigate(`/inventory/export-requests/${saved.id}`);
    } catch (submitErr) {
      setFormError(submitErr.message || 'Xác nhận xuất/trả phụ tùng thất bại');
    }
  }

  const slipExportedBefore = Boolean(selectedRo?.exportRequestId);
  // So dong THUC SU can thao tac (bo qua dong da xong va dong thieu ton kho).
  const tickableCount = items.filter((it) => lineState(it, slipExportedBefore).canTick).length;
  const allTicked = tickableCount > 0 && tickedIds.size >= tickableCount;

  // Phai DIEN DU ca 3 phan moi cho luu: tich het dong, chon nguoi lay, va da ky.
  const missing = [];
  if (!allTicked) missing.push(`tích đủ các dòng (${tickedIds.size}/${tickableCount})`);
  if (!receivedBy) missing.push('chọn người lấy');
  if (signatureEmpty) missing.push('ký xác nhận');
  const canSubmit = Boolean(selectedRo) && !selectedRo?.locked && missing.length === 0;
  const missingLabel = missing.length ? `Còn thiếu: ${missing.join(', ')}` : '';

  if (!branchId) {
    return (
      <div className="er-form__error">
        {loadingBranches ? 'Đang tải danh sách chi nhánh...' : (branchError || 'Vui lòng chọn chi nhánh để tạo phiếu xuất.')}
      </div>
    );
  }

  return (
    <div className="er-form">
      <div className="er-form__header">
        <div>
          <h1 className="er-form__title">Tạo phiếu xuất kho</h1>
          <p className="er-form__subtitle">
            Chọn phiếu sửa chữa (Service Order) cần xuất phụ tùng, điều chỉnh số lượng và lưu.
            Tồn kho sẽ bị trừ ngay khi tạo phiếu.
          </p>
        </div>
        <Link to="/inventory/export-requests" className="btn btn--ghost">
          &laquo; Quay lại
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="er-form__body">
        {/* Chọn lệnh sửa chữa - danh sách luôn hiện để dễ đổi phiếu, không ẩn đi sau khi chọn */}
        <div className="er-form__section">
          <h2 className="er-form__section-title">Lệnh sửa chữa (Repair Order)</h2>
          <div className="er-form__search-picker">
            <input
              className="input"
              type="text"
              placeholder="Tìm theo mã RO, tên khách, biển số xe..."
              value={roSearchTerm}
              onChange={(e) => setRoSearchTerm(e.target.value)}
            />
            {roSearchTerm.trim().length >= 2 && (
              <div className="er-form__search-dropdown">
                {loadingRepairOrders ? (
                  <div className="er-form__hint">Đang tải danh sách LSC...</div>
                ) : visibleRepairOrders.length === 0 ? (
                  <div className="er-form__hint">Không tìm thấy lệnh sửa chữa nào khớp "{roSearchTerm.trim()}".</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Mã RO</th>
                          <th>Khách hàng</th>
                          <th>Xe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRepairOrders.map((ro) => (
                          <tr
                            key={ro.id}
                            className={`er-form__search-row ${selectedRo?.id === ro.id ? 'er-form__search-row--active' : ''}`}
                            onClick={() => selectedRo?.id !== ro.id && handlePickRo(ro)}
                          >
                            <td><span className="font-mono">{ro.repairOrderCode || '—'}</span></td>
                            <td>{ro.customerName || '—'}</td>
                            <td>{ro.vehiclePlate || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedRo && (
            <div className="er-form__so-summary">
              <div className="er-form__info-grid">
                <div><strong>Mã RO:</strong> <span className="font-mono">{selectedRo.repairOrderCode || '—'}</span></div>
                <div><strong>Khách hàng:</strong> {selectedRo.customerName || '—'}</div>
                <div><strong>Xe:</strong> {selectedRo.vehiclePlate || '—'}</div>
                <div><strong>Tổ trưởng:</strong> {selectedRo.teamLeaderName || '—'}</div>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleChangeRo}>
                Bỏ chọn
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
                  <label className="er-form__label">Mã phiếu (theo mã lệnh sửa chữa)</label>
                  <input
                    className="input"
                    type="text"
                    value={selectedRo.repairOrderCode || ''}
                    readOnly
                  />
                </div>

                <div className="er-form__field">
                  <label className="er-form__label">Người lấy <span className="required">*</span></label>
                  {receivedBy ? (
                    <div className="er-form__picked-chip">
                      <span>{receivedByName}</span>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={handleChangeTechnician}>
                        Bỏ chọn
                      </button>
                    </div>
                  ) : (
                    <div className="er-form__search-picker">
                      <input
                        className="input"
                        type="text"
                        placeholder={loadingTechnicians ? 'Đang tải danh sách thợ...' : 'Tìm theo mã hoặc tên thợ...'}
                        value={technicianSearchTerm}
                        onChange={(e) => setTechnicianSearchTerm(e.target.value)}
                      />
                      {technicianSearchTerm.trim().length > 0 && (
                        <div className="er-form__search-dropdown">
                          {visibleTechnicians.length === 0 ? (
                            <div className="er-form__hint">Không tìm thấy thợ nào khớp "{technicianSearchTerm.trim()}".</div>
                          ) : (
                            <ul className="er-form__tech-list">
                              {visibleTechnicians.map((t) => (
                                <li
                                  key={t.id}
                                  className="er-form__search-row"
                                  onClick={() => handlePickTechnician(t)}
                                >
                                  {t.employeeId && <span className="font-mono">{t.employeeId}</span>}
                                  <span>{t.fullName}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="er-form__items">
              <div className="er-form__items-header">
                <h2 className="er-form__items-title">Danh sách phụ tùng</h2>
                <span className="er-form__hint">
                  Phải tích đủ tất cả các dòng rồi mới ký xác nhận được. Số lượng do hệ thống tính, không sửa tay.
                  {tickableCount > 0 && ` (đã tích ${tickedIds.size}/${tickableCount})`}
                  {loadingRoDetail && ' Đang tải...'}
                </span>
              </div>

              {selectedRo.locked && (
                <div className="er-form__hint er-form__hint--error">
                  Lệnh sửa chữa đã chốt (chờ thanh toán/đã xuất hóa đơn/đã hủy) — không thể xuất hoặc trả phụ tùng nữa.
                </div>
              )}

              {items.length === 0 ? (
                <p className="er-form__empty">
                  Phiếu sửa chữa không có phụ tùng (PART) nào.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Mã phụ tùng</th>
                        <th>Tên phụ tùng</th>
                        <th>Đơn vị</th>
                        <th className="text-right" style={{ width: 90 }}>Yêu cầu</th>
                        <th className="text-right" style={{ width: 90 }}>Đã xuất</th>
                        <th className="text-right" style={{ width: 90 }}>Tồn kho</th>
                        <th style={{ width: 210 }}>Xác nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const st = lineState(it, slipExportedBefore);
                        return (
                          <tr key={it.productId} className={st.danger ? 'er-form__row--alert' : ''}>
                            <td>{idx + 1}</td>
                            <td><span className="font-mono">{it.productCode}</span></td>
                            <td>{it.productName}</td>
                            <td>{it.unit || '—'}</td>
                            <td className="text-right">{it.requiredQuantity}</td>
                            <td className="text-right">{it.exportedQuantity}</td>
                            <td className="text-right">{it.currentStock}</td>
                            <td>
                              <label className="er-form__confirm-cell">
                                {st.canTick && !selectedRo.locked && (
                                  <input
                                    type="checkbox"
                                    checked={tickedIds.has(it.productId)}
                                    onChange={() => toggleTick(it.productId)}
                                  />
                                )}
                                <span className={st.danger ? 'er-form__confirm-label--alert' : ''}>
                                  {st.label}
                                </span>
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Nguoi lay TU KY xac nhan da nhan phu tung - giong het co che
                  khach hang ky tren phieu quyet toan, de biet chac chan AI
                  da lay hang chu khong chi ghi ten qua dropdown. */}
              <div className="er-form__signature">
                <h3 className="er-form__add-title">Người lấy ký xác nhận <span className="required">*</span></h3>
                <div className="er-form__signature-pad">
                  <SignaturePad ref={signaturePadRef} onChange={setSignatureEmpty} />
                </div>
                {!signatureEmpty && receivedByName && (
                  <div className="er-form__signature-name">{receivedByName}</div>
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
              Hủy
            </Link>
            <PermissionGate permission="export_requests:create">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={submitting || !canSubmit}
                title={canSubmit ? undefined : missingLabel}
              >
                {submitting ? 'Đang lưu...' : 'Xác nhận xuất/trả'}
              </button>
            </PermissionGate>
          </div>
        )}
      </form>
    </div>
  );
}
