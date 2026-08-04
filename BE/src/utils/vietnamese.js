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
 * SQL fragment: so khớp không phân biệt hoa/thường & dấu tiếng Việt.
 * Cột DB qua dbo.RemoveVietnameseAccents; tham số đã normalizeVietnamese.
 */
function sqlAccentInsensitiveLike(columnExpr, paramName) {
  return `dbo.RemoveVietnameseAccents(COALESCE(${columnExpr}, N'')) LIKE @${paramName}`;
}

/** Gán params[paramKey] = %needle% đã bỏ dấu / lower. */
function bindNormalizedLikeParam(params, paramKey, rawValue) {
  params[paramKey] = `%${normalizeVietnamese(rawValue)}%`;
  return paramKey;
}

module.exports = {
  normalizeVietnamese,
  sqlAccentInsensitiveLike,
  bindNormalizedLikeParam,
};
