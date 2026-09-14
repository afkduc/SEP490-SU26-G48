const ApiError = require('../../utils/ApiError');

/**
 * Validate payload khi NV Kho xac nhan 1 lan lay hang (xuat them / tra hang).
 *
 * KHONG nhan so luong tu FE: so luong tung dong duoc SERVER tinh lai theo
 * cong thuc "yeu cau hien tai - da xuat rong" (xem
 * ExportRequestRepositoryImpl.confirmPickup) - FE chi gui len nhung dong nao
 * duoc tick. Lam vay thi du FE co bi sua, kho cung khong bao gio lech so.
 *
 * @param {Object} payload - req.body
 * @returns {Object} { branch_id, repair_order_id, performed_by, received_by,
 *                     signature_data, product_ids: number[] }
 */
function validateConfirmPickup(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError(400, 'Body phai la object');
  }

  const branchId = Number(payload.branchId ?? payload.branch_id);
  if (!Number.isFinite(branchId) || branchId <= 0) {
    throw new ApiError(400, 'Vui lòng chọn chi nhánh');
  }

  const repairOrderId = Number(payload.repairOrderId ?? payload.repair_order_id);
  if (!Number.isFinite(repairOrderId) || repairOrderId <= 0) {
    throw new ApiError(400, 'Vui lòng chọn lệnh sửa chữa');
  }

  const performedBy = Number(payload.performedBy ?? payload.performed_by);
  if (!Number.isFinite(performedBy) || performedBy <= 0) {
    throw new ApiError(400, 'Không xác định được nhân viên kho');
  }

  const receivedBy = Number(payload.receivedBy ?? payload.received_by);
  if (!Number.isFinite(receivedBy) || receivedBy <= 0) {
    throw new ApiError(400, 'Vui lòng chọn người lấy');
  }

  const signatureData = payload.receivedSignatureData ?? payload.signature_data;
  if (!(signatureData || '').startsWith('data:image/png;base64,')) {
    throw new ApiError(400, 'Vui lòng ký xác nhận');
  }

  const rawIds = Array.isArray(payload.productIds ?? payload.product_ids)
    ? (payload.productIds ?? payload.product_ids)
    : [];
  const productIds = [...new Set(rawIds.map(Number))]
    .filter((n) => Number.isInteger(n) && n > 0);
  if (productIds.length === 0) {
    throw new ApiError(400, 'Chưa chọn dòng phụ tùng nào để xác nhận');
  }
  if (productIds.length > 100) {
    throw new ApiError(400, 'Toi da 100 dong moi lan xac nhan');
  }

  return {
    branch_id: branchId,
    repair_order_id: repairOrderId,
    performed_by: performedBy,
    received_by: receivedBy,
    signature_data: signatureData,
    product_ids: productIds,
  };
}

module.exports = { validateConfirmPickup };
