// Cột "YÊU CẦU THỰC HIỆN" của biểu mẫu Mazda "Phụ lục 3 - Phiếu kiểm tra bảo
// dưỡng định kỳ". DB lưu mã 1 chữ (service_package_items.action_code) nhưng
// màn khoang sửa luôn ghi ra chữ tiếng Việt đầy đủ - thợ đọc một lần là biết
// phải làm gì, không phải nhớ ký hiệu.
//
// Bản sao của BE/src/domain/maintenanceChecklist.js và
// FE/src/constants/maintenanceChecklist.js (3 bundle riêng, không chia sẻ
// module được) - sửa bên nào thì sửa cả 3.
export const ACTION_LABELS = Object.freeze({
  I: "Kiểm tra, điều chỉnh hoặc thay thế nếu cần thiết",
  R: "Thay thế",
  M: "Tháo, vệ sinh và đo kiểm",
  V: "Kiểm tra bằng mắt (không tháo lắp)",
});

export function actionLabel(actionCode) {
  return ACTION_LABELS[String(actionCode || "").toUpperCase()] || "";
}

// Chỉ đầu mục KIỂM TRA mới ghi kết quả Đạt/Không đạt (cột KẾT QUẢ OK/NG của
// biểu mẫu). Đầu mục "Thay thế" và đầu mục ngoài gói bảo dưỡng chỉ tích đã
// làm xong như cũ.
export function needsCheckResult(actionCode) {
  return ["I", "M", "V"].includes(String(actionCode || "").toUpperCase());
}

export const OTHER_GROUP_LABEL = "Hạng mục khác";

// Gom đầu mục theo 5 nhóm công việc của biểu mẫu, đầu mục ngoài biểu mẫu dồn
// xuống cuối. Thứ tự trong từng nhóm giữ nguyên theo checklist_order BE đã sắp.
export function groupServiceTasks(tasks) {
  const groups = [];
  const byName = new Map();
  for (const t of tasks) {
    const name = t.checklistGroup || OTHER_GROUP_LABEL;
    if (!byName.has(name)) {
      const g = { name, tasks: [] };
      byName.set(name, g);
      groups.push(g);
    }
    byName.get(name).tasks.push(t);
  }
  return groups.sort((a, b) => Number(a.name === OTHER_GROUP_LABEL) - Number(b.name === OTHER_GROUP_LABEL));
}
