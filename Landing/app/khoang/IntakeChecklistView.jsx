"use client";

// Ban chi-xem "Tiep nhan va ban giao xe" (tinh trang xe luc tiep nhan) danh
// cho man khoang xe cong khai (kiosk). Doc lap voi
// FE/src/pages/repairsettlement/IntakeChecklistView.jsx - 2 app Next.js/Vite
// rieng biet khong dung chung component duoc - nhung GIU DUNG cung nhom/nhan
// truong voi ban FE (doc thang tu service_orders.intake_checklist, xem
// RepairOrder.intakeChecklist o BE) de hien thi nhat quan giua man CVDV va
// man khoang xe.
import styles from "./kiosk.module.css";

const INTERIOR_FIELDS = [
  ["ac", "Máy lạnh"], ["handbrake", "Phanh tay"],
  ["brakePedalClutch", "Bàn đạp phanh / Ly hợp"], ["seatsHeadliner", "Ghế, la phông"],
];
const ITEMS_IN_CAR_FIELDS = [
  ["charger", "Thiết bị sạc"], ["memoryCardUsb", "Thẻ nhớ, USB"], ["glassesPerfume", "Mắt kính, nước hoa"],
];
const EXTERIOR_LEFT_FIELDS = [
  ["mirrorFrontLeft", "Kính chiếu hậu trước trái"], ["tireFrontLeft", "Bánh xe trước trái (lốp, mâm xe, vòi xe)"],
  ["tireRearLeft", "Bánh xe sau trái (lốp, mâm xe, vòi xe)"], ["logoDecals", "Logo, tem, nhãn"],
  ["windshieldFront", "Kính chắn gió trước"], ["wiperFront", "Gạt mưa trước"],
  ["headlightFrontLeft", "Đèn pha trước trái"], ["fogLightLeft", "Đèn sương mù trái"],
  ["headlightFrontRight", "Đèn pha trước phải"], ["fogLightRight", "Đèn sương mù phải"],
];
const EXTERIOR_RIGHT_FIELDS = [
  ["mirrorFrontRight", "Kính chiếu hậu trước phải"], ["tireFrontRight", "Bánh xe trước phải (lốp, mâm xe, vòi xe)"],
  ["tireRearRight", "Bánh xe sau phải (lốp, mâm xe, vòi xe)"], ["fuelCap", "Nắp bình xăng"],
  ["windshieldRear", "Kính chắn gió sau"], ["wiperRear", "Gạt mưa sau"],
  ["turnSignalRearRight", "Đèn báo rẽ sau phải"], ["taillightRight", "Đèn lái sau phải"],
  ["turnSignalRearLeft", "Đèn báo rẽ sau trái"], ["spareTireToolkit", "Lốp dự phòng, bộ dụng cụ đồ nghề"],
];
const ENGINE_BAY_FIELDS = [
  ["battery", "Bình điện"], ["engineOil", "Dầu động cơ"], ["coolant", "Nước làm mát động cơ"],
  ["washerFluid", "Nước rửa kính"], ["brakeClutchFluid", "Dầu phanh/ly hợp"],
  ["powerSteeringFluid", "Dầu trợ lực lái"], ["hoseCondition", "Tình trạng các đường ống"], ["driveBelt", "Dây đai dẫn động"],
];
const FUEL_GAUGE_LABEL = { E: "E (cạn)", "1/4": "1/4", "1/2": "1/2", "3/4": "3/4", F: "F (đầy)" };

function Badge({ value }) {
  if (value === "OK") return <span className={`${styles.intakeBadge} ${styles.intakeBadgeOk}`}>OK</span>;
  if (value === "NG") return <span className={`${styles.intakeBadge} ${styles.intakeBadgeNg}`}>NG</span>;
  if (value === true) return <span className={`${styles.intakeBadge} ${styles.intakeBadgeOk}`}>Có</span>;
  if (value === false) return <span className={`${styles.intakeBadge} ${styles.intakeBadgeMuted}`}>K</span>;
  return <span className={styles.intakeBadgeEmpty}>—</span>;
}

function Row({ label, value }) {
  return (
    <div className={styles.intakeRow}>
      <span>{label}</span>
      <Badge value={value} />
    </div>
  );
}

function Group({ title, group, fields, v }) {
  return (
    <>
      <div className={styles.intakeGroupTitle}>{title}</div>
      {fields.map(([key, label]) => (
        <Row key={key} label={label} value={v?.[group]?.[key] ?? null} />
      ))}
    </>
  );
}

export default function IntakeChecklistView({ value }) {
  const v = value || {};
  return (
    <div>
      <div className={styles.intakeHint}>Diễn giải: OK: Tốt / NG: Không tốt / K: Không</div>

      <Group title="Kiểm tra nội thất" group="interior" fields={INTERIOR_FIELDS} v={v} />

      <div className={styles.intakeGroupTitle}>Mức nhiên liệu / Đèn cảnh báo</div>
      <div className={styles.intakeRow}><span>Mức nhiên liệu</span><span>{FUEL_GAUGE_LABEL[v.fuelGauge] || "—"}</span></div>
      <div className={styles.intakeRow}><span>Đèn cảnh báo</span><span>{v.warningLights || "—"}</span></div>

      <Group title="Vật dụng trong xe" group="itemsInCar" fields={ITEMS_IN_CAR_FIELDS} v={v} />
      <div className={styles.intakeRow}><span>Vật dụng khác</span><span>{v.itemsInCarOther || "—"}</span></div>

      <Group title="Kiểm tra bên trái, phía trước xe" group="exteriorLeftFront" fields={EXTERIOR_LEFT_FIELDS} v={v} />
      <Group title="Kiểm tra bên phải, phía sau xe" group="exteriorRightRear" fields={EXTERIOR_RIGHT_FIELDS} v={v} />
      <Group title="Kiểm tra khoang động cơ" group="engineBay" fields={ENGINE_BAY_FIELDS} v={v} />

      <div className={styles.intakeGroupTitle}>Lưu ý</div>
      <div className={styles.intakeNoteText}>{v.notes || "—"}</div>
    </div>
  );
}
