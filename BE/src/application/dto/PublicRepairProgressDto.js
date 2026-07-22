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
  static fromEntity(entity) {
    if (!entity) return null;
    return {
      code: entity.code,
      status: entity.status,
      branchName: entity.branchName,
      createdAt: toDDMMYYYY(entity.createdAt),
      completedAt: toDDMMYYYY(entity.completedAt),
      tasks: entity.tasks.map((t) => ({
        taskName: t.taskName,
        isDone: t.isDone,
      })),
    };
  }
}

module.exports = PublicRepairProgressDto;
