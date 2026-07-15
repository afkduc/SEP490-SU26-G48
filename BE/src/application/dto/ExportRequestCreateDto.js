const ApiError = require('../../utils/ApiError');

/**
 * Validate payload FE gui len khi tao phieu xuat.
 * Tra ve object da duoc chuan hoa hoac nem ApiError(400).
 *
 * @param {Object} payload - req.body
 * @returns {Object} { branch_id, service_order_id, performed_by,
 *                     export_date, notes?, items: [{ product_id, product_code,
 *                     product_name, unit?, quantity }] }
 */
function validateCreateExportRequest(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError(400, 'Body phai la object');
  }

  const branchId = Number(payload.branchId ?? payload.branch_id);
  if (!Number.isFinite(branchId) || branchId <= 0) {
    throw new ApiError(400, 'branchId khong hop le');
  }

  const serviceOrderId = Number(payload.serviceOrderId ?? payload.service_order_id);
  if (!Number.isFinite(serviceOrderId) || serviceOrderId <= 0) {
    throw new ApiError(400, 'serviceOrderId khong hop le');
  }

  const performedBy = Number(payload.performedBy ?? payload.performed_by);
  if (!Number.isFinite(performedBy) || performedBy <= 0) {
    throw new ApiError(400, 'performedBy khong hop le');
  }

  const notes = payload.notes ?? null;
  if (notes != null && String(notes).length > 500) {
    throw new ApiError(400, 'notes qua dai (max 500 ky tu)');
  }

  let exportDate = payload.exportDate ?? payload.export_date ?? new Date();
  if (typeof exportDate === 'string') {
    const parsed = new Date(exportDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, 'exportDate khong hop le');
    }
    exportDate = parsed;
  } else if (!(exportDate instanceof Date)) {
    throw new ApiError(400, 'exportDate khong hop le');
  }

  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  if (itemsRaw.length === 0) {
    throw new ApiError(400, 'Phieu xuat phai co it nhat 1 dong');
  }
  if (itemsRaw.length > 50) {
    throw new ApiError(400, 'Toi da 50 dong moi phieu');
  }

  const items = itemsRaw.map((raw, idx) => {
    const productId = raw.productId ?? raw.product_id;
    const productCode = (raw.productCode ?? raw.product_code ?? '').toString().trim();
    const productName = (raw.productName ?? raw.product_name ?? '').toString().trim();
    const quantity = Number(raw.quantity);

    if (!productId) {
      throw new ApiError(400, `Dong ${idx + 1}: thieu productId`);
    }
    if (!Number.isFinite(Number(productId)) || Number(productId) <= 0) {
      throw new ApiError(400, `Dong ${idx + 1}: productId khong hop le`);
    }
    if (!productCode) {
      throw new ApiError(400, `Dong ${idx + 1}: productCode khong duoc trong`);
    }
    if (!productName) {
      throw new ApiError(400, `Dong ${idx + 1}: productName khong duoc trong`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new ApiError(400, `Dong ${idx + 1}: quantity phai la so nguyen duong`);
    }

    return {
      product_id: Number(productId),
      product_code: productCode,
      product_name: productName,
      unit: raw.unit ?? null,
      quantity,
    };
  });

  return {
    branch_id: branchId,
    service_order_id: serviceOrderId,
    performed_by: performedBy,
    export_date: exportDate,
    notes,
    items,
  };
}

module.exports = { validateCreateExportRequest };