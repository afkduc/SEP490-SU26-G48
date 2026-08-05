const ApiError = require('../../utils/ApiError');

/**
 * Validate payload FE gui len khi tao phieu nhap.
 * Tra ve object da duoc chuan hoa (so, trim string) hoac nem ApiError(400).
 *
 * @param {Object} payload - req.body
 * @returns {Object} { branch_id, supplier_id?, supplier_invoice_no, requested_by,
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

  const supplierInvoiceNo = String(
    payload.supplierInvoiceNo ?? payload.supplier_invoice_no ?? '',
  ).trim();
  if (!supplierInvoiceNo) {
    throw new ApiError(400, 'So hoa don nha cung cap khong duoc trong');
  }
  if (supplierInvoiceNo.length > 50) {
    throw new ApiError(400, 'supplierInvoiceNo qua dai (max 50 ky tu)');
  }

  const notes = payload.notes ?? null;
  if (notes != null && String(notes).length > 500) {
    throw new ApiError(400, 'notes qua dai (max 500 ky tu)');
  }

  // Ngày nhập luôn là thời điểm thực tế tạo phiếu; không nhận ngày tùy chọn từ client.
  const importDate = new Date();

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

    const normalizedProductId = Number(productId);
    if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
      throw new ApiError(400, `Dong ${idx + 1}: productId khong hop le`);
    }

    return {
      product_id: normalizedProductId,
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
