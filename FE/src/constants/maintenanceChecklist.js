// Cột "YÊU CẦU THỰC HIỆN" của biểu mẫu Mazda "Phụ lục 3 - Phiếu kiểm tra bảo
// dưỡng định kỳ". Trong DB lưu mã 1 chữ (service_package_items.action_code),
// nhưng mọi chỗ hiển thị cho người dùng đều ghi ra chữ tiếng Việt đầy đủ đúng
// như chú giải cuối biểu mẫu - không hiện I/R/M/V.
//
// Bản sao của BE/src/domain/maintenanceChecklist.js (FE và BE là 2 bundle
// riêng, không chia sẻ module được) - sửa bên nào thì sửa cả bên kia.
export const ACTION_LABELS = Object.freeze({
  I: 'Kiểm tra, điều chỉnh hoặc thay thế nếu cần thiết',
  R: 'Thay thế',
  M: 'Tháo, vệ sinh và đo kiểm',
  V: 'Kiểm tra bằng mắt (không tháo lắp)',
});

export function actionLabel(actionCode) {
  return ACTION_LABELS[String(actionCode || '').toUpperCase()] || '';
}

// Chỉ đầu mục KIỂM TRA mới có kết quả Đạt/Không đạt (cột KẾT QUẢ OK/NG của
// biểu mẫu). Đầu mục "Thay thế" chỉ tích đã thay xong, không đánh giá.
export function needsCheckResult(actionCode) {
  return ['I', 'M', 'V'].includes(String(actionCode || '').toUpperCase());
}

// Đầu mục phải thay thì mới tự kèm phụ tùng vào phiếu; đầu mục kiểm tra chỉ
// thay KHI CẦN nên phụ tùng để tổ trưởng/thợ bổ sung sau, tránh xuất kho thừa
// và đội hoá đơn của khách.
export function consumesPart(actionCode) {
  return String(actionCode || '').toUpperCase() === 'R';
}

// Nhóm cho đầu mục không thuộc biểu mẫu bảo dưỡng định kỳ (dịch vụ lẻ, phụ
// tùng khách yêu cầu thêm...).
export const OTHER_GROUP_LABEL = 'Hạng mục khác';
