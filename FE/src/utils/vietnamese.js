/**
 * Chuẩn hóa tiếng Việt: bỏ dấu + chữ thường.
 * Dùng để so khớp tìm kiếm (vd "nguyen van a" ↔ "Nguyễn Văn A").
 */
export function normalizeVietnamese(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}
