const ApiError = require('../../utils/ApiError');

/**
 * Validate payload FE gui len khi tao phieu nhap.
 * Tra ve object da duoc chuan hoa (so, trim string) hoac nem ApiError(400).
 *
 * @param {Object} payload - req.body
 * @returns {Object} { branch_id, supplier_id?, supplier_invoice_no?, requested_by,
 *                     import_date, notes?, items: [{ product_id, product_code,
 *                     product_name, unit?, quantity }] }
 */
function validateCreateImportRequest(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError(400, 'Body phai la object');
  }

  const branchId = Number(payload.branchId ?? payload.branch_id);
  if (!Number.isFinite(branchId) || branchId <= 0) {
    throw new ApiError(400, 'branchId khong hop le');
  }

  const requestedBy = Number(payload.requestedBy ?? payload.requested_by);
  if (!Number.isFinite(requestedBy) || requestedBy <= 0) {
    throw new ApiError(400, 'requestedBy khong hop le');
  }

  const supplierIdRaw = payload.supplierId ?? payload.supplier_id;
  const supplierId = supplierIdRaw == null || supplierIdRaw === ''
    ? null
    : Number(supplierIdRaw);
  if (supplierId !== null && !Number.isFinite(supplierId)) {
    throw new ApiError(400, 'supplierId khong hop le');
  }

  const supplierInvoiceNo = payload.supplierInvoiceNo ?? payload.supplier_invoice_no ?? null;
  if (supplierInvoiceNo != null && String(supplierInvoiceNo).length > 50) {
    throw new ApiError(400, 'supplierInvoiceNo qua dai (max 50 ky tu)');
  }

  const notes = payload.notes ?? null;
  if (notes != null && String(notes).length > 500) {
    throw new ApiError(400, 'notes qua dai (max 500 ky tu)');
  }

  let importDate = payload.importDate ?? payload.import_date ?? new Date();
  if (typeof importDate === 'string') {
    const parsed = new Date(importDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, 'importDate khong hop le');
    }
    importDate = parsed;
  } else if (!(importDate instanceof Date)) {
    throw new ApiError(400, 'importDate khong hop le');
  }

  const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
  if (itemsRaw.length === 0) {
    throw new ApiError(400, 'Phieu nhap phai co it nhat 1 dong');
  }
  if (itemsRaw.length > 50) {
    throw new ApiError(400, 'Toi da 50 dong moi phieu');
  }

  const items = itemsRaw.map((raw, idx) => {
    const productId = raw.productId ?? raw.product_id;
    const productCode = (raw.productCode ?? raw.product_code ?? '').toString().trim();
    const productName = (raw.productName ?? raw.product_name ?? '').toString().trim();
    const quantity = Number(raw.quantity);

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
      product_id: productId != null ? Number(productId) : null,
      product_code: productCode,
      product_name: productName,
      unit: raw.unit ?? null,
      quantity,
    };
  });

  return {
    branch_id: branchId,
    supplier_id: supplierId,
    supplier_invoice_no: supplierInvoiceNo,
    requested_by: requestedBy,
    import_date: importDate,
    notes,
    items,
  };
}

/**
 * Validate ly do tu choi.
 */
function validateReject(payload) {
  const reason = (payload?.rejectReason ?? payload?.reject_reason ?? '').toString().trim();
  if (!reason) {
    throw new ApiError(400, 'rejectReason khong duoc trong');
  }
  if (reason.length > 500) {
    throw new ApiError(400, 'rejectReason qua dai (max 500 ky tu)');
  }
  return reason;
}

module.exports = { validateCreateImportRequest, validateReject };