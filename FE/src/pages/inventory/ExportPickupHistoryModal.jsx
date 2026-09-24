import { useEffect, useState } from 'react';
import { getExportPickupsApi } from '../../services/exportRequestApi';
import './ExportPickupHistoryModal.css';

// Lich su LUU PHIEU xuat kho: moi lan NV Kho bam "Xac nhan xuat/tra" la 1 ban
// ghi (export_request_pickups) - xem lai lan do da xuat/tra nhung phu tung
// nao, ai lay, ai xuat, ky luc nao. Chi doc, khong sua duoc gi. Bang phu tung
// ngoai form luon la trang thai MOI NHAT (cong don), con day la tung lan mot.
export default function ExportPickupHistoryModal({ exportRequestId, repairOrderCode, onClose }) {
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(Boolean(exportRequestId));
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!exportRequestId) return undefined;
    let mounted = true;
    setLoading(true);
    getExportPickupsApi(exportRequestId)
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res) ? res : [];
        setPickups(list);
        // Mo san lan moi nhat cho khoi phai bam them.
        setOpenId(list[0]?.id ?? null);
      })
      .catch((err) => { if (mounted) setError(err.message || 'Không tải được lịch sử'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [exportRequestId]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg eph" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Lịch sử lưu phiếu xuất</div>
            <div className="eph__subtitle">
              Phiếu <span className="font-mono">{repairOrderCode || '—'}</span>
              {!loading && !error && ` · ${pickups.length} lần lưu`}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">×</button>
        </div>

        <div className="modal-body">
          {loading && <div className="eph__empty">Đang tải lịch sử…</div>}
          {!loading && error && <div className="eph__empty eph__empty--error">{error}</div>}
          {!loading && !error && pickups.length === 0 && (
            <div className="eph__empty">
              Phiếu này chưa được lưu lần nào. Mỗi lần bấm "Xác nhận xuất/trả" sẽ tạo 1 bản ghi ở đây.
            </div>
          )}

          {!loading && !error && pickups.map((pk) => {
            const isOpen = openId === pk.id;
            const isLatest = pk.seq === pickups.length;
            return (
              <div key={pk.id} className={`eph__item ${isOpen ? 'eph__item--open' : ''}`}>
                <button
                  type="button"
                  className="eph__item-head"
                  onClick={() => setOpenId(isOpen ? null : pk.id)}
                  aria-expanded={isOpen}
                >
                  <span className="eph__seq">Lần {pk.seq}</span>
                  <span className="eph__meta">
                    <span className="eph__time">{pk.signedAtLabel || '—'}</span>
                    <span className="eph__who">
                      Người lấy: <b>{pk.receivedByName || '—'}</b>
                      {' · '}Người xuất: <b>{pk.performedByName || '—'}</b>
                    </span>
                  </span>
                  <span className="eph__sum">
                    {pk.exportQuantity > 0 && <span className="eph__chip eph__chip--export">Xuất {pk.exportQuantity}</span>}
                    {pk.returnQuantity > 0 && <span className="eph__chip eph__chip--return">Trả {pk.returnQuantity}</span>}
                    <span className="eph__lines">{pk.lines.length} dòng</span>
                    {isLatest && <span className="eph__chip eph__chip--latest">Mới nhất</span>}
                  </span>
                  <span className="eph__caret">{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="eph__item-body">
                    <div className="table-responsive">
                      <table className="table">
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>#</th>
                            <th>Mã phụ tùng</th>
                            <th>Tên phụ tùng</th>
                            <th>Đơn vị</th>
                            <th style={{ width: 110 }}>Trạng thái</th>
                            <th className="text-right" style={{ width: 90 }}>Số lượng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pk.lines.map((ln, idx) => (
                            <tr key={`${pk.id}-${ln.productId}-${idx}`}>
                              <td>{idx + 1}</td>
                              <td><span className="font-mono">{ln.productCode}</span></td>
                              <td>{ln.productName}</td>
                              <td>{ln.unit || '—'}</td>
                              <td>
                                <span className={`eph__chip ${ln.type === 'return' ? 'eph__chip--return' : 'eph__chip--export'}`}>
                                  {ln.type === 'return' ? 'Trả hàng' : 'Xuất kho'}
                                </span>
                              </td>
                              <td className="text-right">{ln.type === 'return' ? `+${ln.quantity}` : `−${ln.quantity}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(pk.issuerSignatureData || pk.signatureData) && (
                      <div className="eph__signatures">
                        {/* Nguoi xuat ky truoc, nguoi nhan ky sau - nhan vai
                            tro ghi HANG TREN cung anh chu ky, khong nhet
                            chung 1 dong voi ten kieu "(NV kho)". */}
                        {pk.issuerSignatureData && (
                          <div className="eph__signature">
                            <div className="eph__signature-role">Nhân viên kho</div>
                            <img src={pk.issuerSignatureData} alt={`Chữ ký nhân viên kho lần ${pk.seq}`} />
                            <div className="eph__signature-name">{pk.performedByName}</div>
                          </div>
                        )}
                        {pk.signatureData && (
                          <div className="eph__signature">
                            <div className="eph__signature-role">Người lấy</div>
                            <img src={pk.signatureData} alt={`Chữ ký người lấy lần ${pk.seq}`} />
                            <div className="eph__signature-name">{pk.receivedByName}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
