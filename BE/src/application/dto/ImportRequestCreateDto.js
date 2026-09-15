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
    throw new ApiError(400, 'Vui lòng chọn chi nhánh');
  }

  const requestedBy = Number(payload.requestedBy ?? payload.requested_by);
  if (!Number.isFinite(requestedBy) || requestedBy <= 0) {
    throw new ApiError(400, 'Không xác định được người nhập kho');
  }

  const supplierIdRaw = payload.supplierId ?? payload.supplier_id;
  const supplierId = supplierIdRaw == null || supplierIdRaw === ''
    ? null
    : Number(supplierIdRaw);
  if (supplierId !== null && !Number.isFinite(supplierId)) {
    throw new ApiError(400, 'Nhà cung cấp không hợp lệ');
  }

  const supplierInvoiceNo = String(
    payload.supplierInvoiceNo ?? payload.supplier_invoice_no ?? '',
  ).trim();
  if (!supplierInvoiceNo) {
    throw new ApiError(400, 'Số hóa đơn nhà cung cấp không được để trống');
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
    throw new ApiError(400, 'Phiếu nhập phải có ít nhất 1 phụ tùng');
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
      throw new ApiError(400, `Dòng ${idx + 1}: mã phụ tùng không được để trống`);
    }
    if (!productName) {
      throw new ApiError(400, `Dòng ${idx + 1}: tên phụ tùng không được để trống`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new ApiError(400, `Dòng ${idx + 1}: số lượng phải là số nguyên dương`);
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
