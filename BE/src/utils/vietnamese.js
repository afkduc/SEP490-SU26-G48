// Chuan hoa chuoi tieng Viet ve dang khong dau, chu thuong - dung de so sanh/tim
// kiem khong phan biet dau (vd nguoi dung go "duong" van khop "dưỡng").
// SQL Server COLLATE ..._CI_AI chi bo dau tren cac nguyen am co ban (a, e, i, o, u, y)
// nhung khong gop ư/ơ ve u/o va khong gop đ ve d, nen can chuan hoa o tang ung dung.

function normalizeVietnamese(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/**
 * Biểu thức SQL inline bỏ dấu (REPLACE lồng nhau) — tránh scalar UDF
 * dbo.RemoveVietnameseAccents (rất chậm khi LIKE trên nhiều cột).
 */
function sqlUnaccentExpr(columnExpr) {
  let expr = `LOWER(COALESCE(${columnExpr}, N''))`;
  // đ/Đ trước; còn lại map từng ký tự có dấu → không dấu
  const pairs = [
    ['đ', 'd'],
    ['à', 'a'], ['á', 'a'], ['ả', 'a'], ['ã', 'a'], ['ạ', 'a'],
    ['ă', 'a'], ['ằ', 'a'], ['ắ', 'a'], ['ẳ', 'a'], ['ẵ', 'a'], ['ặ', 'a'],
    ['â', 'a'], ['ầ', 'a'], ['ấ', 'a'], ['ẩ', 'a'], ['ẫ', 'a'], ['ậ', 'a'],
    ['è', 'e'], ['é', 'e'], ['ẻ', 'e'], ['ẽ', 'e'], ['ẹ', 'e'],
    ['ê', 'e'], ['ề', 'e'], ['ế', 'e'], ['ể', 'e'], ['ễ', 'e'], ['ệ', 'e'],
    ['ì', 'i'], ['í', 'i'], ['ỉ', 'i'], ['ĩ', 'i'], ['ị', 'i'],
    ['ò', 'o'], ['ó', 'o'], ['ỏ', 'o'], ['õ', 'o'], ['ọ', 'o'],
    ['ô', 'o'], ['ồ', 'o'], ['ố', 'o'], ['ổ', 'o'], ['ỗ', 'o'], ['ộ', 'o'],
    ['ơ', 'o'], ['ờ', 'o'], ['ớ', 'o'], ['ở', 'o'], ['ỡ', 'o'], ['ợ', 'o'],
    ['ù', 'u'], ['ú', 'u'], ['ủ', 'u'], ['ũ', 'u'], ['ụ', 'u'],
    ['ư', 'u'], ['ừ', 'u'], ['ứ', 'u'], ['ử', 'u'], ['ữ', 'u'], ['ự', 'u'],
    ['ỳ', 'y'], ['ý', 'y'], ['ỷ', 'y'], ['ỹ', 'y'], ['ỵ', 'y'],
  ];
  for (const [from, to] of pairs) {
    expr = `REPLACE(${expr}, N'${from}', N'${to}')`;
  }
  return expr;
}

/**
 * SQL fragment: so khớp không phân biệt hoa/thường & dấu tiếng Việt.
 * Tham số đã qua normalizeVietnamese (dạng %tran%).
 */
function sqlAccentInsensitiveLike(columnExpr, paramName) {
  return `${sqlUnaccentExpr(columnExpr)} LIKE @${paramName}`;
}

/** Gán params[paramKey] = %needle% đã bỏ dấu / lower. */
function bindNormalizedLikeParam(params, paramKey, rawValue) {
  params[paramKey] = `%${normalizeVietnamese(rawValue)}%`;
  return paramKey;
}

/** Chỉ giữ chữ số (SĐT). Không slice — dùng cho tìm contains (0123 khớp 0123456789). */
function phoneDigitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Biểu thức SQL bỏ '-', khoảng trắng, '.', '+' trên cột SĐT.
 * Dùng khi so khớp: UI có thể hiện 0123-456-789 nhưng DB/search là chữ số.
 */
function sqlPhoneDigitsExpr(columnExpr) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${columnExpr}, N''), N'-', N''), N' ', N''), N'.', N''), N'+', N'')`;
}

/**
 * Gán params[paramKey] = %digits% nếu rawValue có chữ số.
 * @returns {string|null} paramKey hoặc null nếu không có số
 */
function bindPhoneDigitsLikeParam(params, paramKey, rawValue) {
  const digits = phoneDigitsOnly(rawValue);
  if (!digits) return null;
  params[paramKey] = `%${digits}%`;
  return paramKey;
}

/** SQL fragment: cột SĐT LIKE @param (param đã qua bindPhoneDigitsLikeParam). */
function sqlPhoneDigitsLike(columnExpr, paramName) {
  return `${sqlPhoneDigitsExpr(columnExpr)} LIKE @${paramName}`;
}

module.exports = {
  normalizeVietnamese,
  sqlUnaccentExpr,
  sqlAccentInsensitiveLike,
  bindNormalizedLikeParam,
  phoneDigitsOnly,
  sqlPhoneDigitsExpr,
  bindPhoneDigitsLikeParam,
  sqlPhoneDigitsLike,
};
