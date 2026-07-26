// DTO rieng cho endpoint public (khong auth) tra cuu tien do sua chua theo ma
// - CHI tra ve du lieu tien do, khong kem ten/SDT khach hang, bien so xe hay
// don gia/thanh tien, de neu ai do do ma cung khong lay duoc thong tin nhay
// cam cua khach khac.
function toDDMMYYYY(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

class PublicRepairProgressDto {
  // "entity" o day co the la RepairOrder (da gan to truong) hoac object
  // thuong (chua gan to truong / da huy) tu findByServiceOrderCode - ca 2 deu
  // co cung shape can dung: code/status/branchName/createdAt/completedAt/tasks.
  //
  // Boc them 2 "moc" dau/cuoi danh sach ("Dang cho sua chua" luon da qua vi
  // xe da duoc tiep nhan, "Hoan thanh" chi qua khi status = 'completed') de
  // khach hang thay duoc ca hanh trinh, khong chi rieng danh sach hang muc.
  // isMilestone=true de FE loai 2 dong nay ra khoi % tien do (chi tinh tren
  // hang muc that su).
  static fromEntity(entity) {
    if (!entity) return null;

    if (entity.status === 'cancelled') {
      return {
        code: entity.code,
        status: entity.status,
        branchName: entity.branchName,
        createdAt: toDDMMYYYY(entity.createdAt),
        completedAt: null,
        tasks: [],
      };
    }

    // Chi hien hang muc CONG VIEC (task_type='service') cho khach - phu tung
    // (task_type='product', vd dau nhot/loc gio) khong lien quan gi den viec
    // theo doi tien do sua chua cua khach, chi la thong tin noi bo cua to
    // truong/kho khi lam viec.
    const isCompleted = entity.status === 'completed';
    const tasks = [
      { taskName: 'Đang chờ sửa chữa', isDone: true, isMilestone: true },
      ...entity.tasks
        .filter((t) => t.taskType === 'service')
        .map((t) => ({ taskName: t.taskName, isDone: t.isDone, isMilestone: false })),
      { taskName: 'Hoàn thành', isDone: isCompleted, isMilestone: true },
    ];

    return {
      code: entity.code,
      status: entity.status,
      branchName: entity.branchName,
      createdAt: toDDMMYYYY(entity.createdAt),
      completedAt: toDDMMYYYY(entity.completedAt),
      tasks,
    };
  }
}

module.exports = PublicRepairProgressDto;
