"use client";

// Ban chi-xem "Tiep nhan va ban giao xe" (tinh trang xe luc tiep nhan) danh
// cho man khoang xe cong khai (kiosk). Doc lap voi
// FE/src/pages/repairsettlement/IntakeChecklistView.jsx - 2 app Next.js/Vite
// rieng biet khong dung chung component duoc - nhung GIU DUNG cung nhom/nhan
// truong voi ban FE (doc thang tu repair_orders.intake_checklist, xem
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

// Kiem tra than vo xe ben ngoai - dong bo voi FE/src/pages/repairsettlement/
// IntakeChecklistSection.jsx (cung 1 bo anh trich tu file mau, copy sang
// Landing/public/vehicle-diagrams/).
const SEGMENT_OPTIONS = [["sedan", "Sedan/Hatchback"], ["suv", "SUV/Crossover"], ["pickup", "Bán tải"]];
const SEGMENT_DIAGRAMS = {
  sedan: ["sedan-left", "sedan-right", "sedan-front", "sedan-rear", "sedan-top"],
  suv: ["suv-left", "suv-right", "suv-front", "suv-rear", "suv-top"],
  pickup: ["pickup-left", "pickup-right", "pickup-front", "pickup-rear", "pickup-top"],
};
const DIAGRAM_LABELS = { left: "Trái", right: "Phải", front: "Trước", rear: "Sau", top: "Trên" };

function detectSegmentFromModelText(modelText) {
  const t = (modelText || "").toLowerCase();
  if (t.includes("bt-50") || t.includes("bt50")) return "pickup";
  if (t.includes("cx-") || t.includes("cx60") || t.includes("cx90") || /\bcx\s*\d/.test(t)) return "suv";
  return "sedan";
}

function ExteriorBodyView({ exteriorBody, vehicleModelText }) {
  const segment = detectSegmentFromModelText(vehicleModelText);
  const images = SEGMENT_DIAGRAMS[segment] || SEGMENT_DIAGRAMS.sedan;
  const segmentLabel = SEGMENT_OPTIONS.find(([key]) => key === segment)?.[1] || segment;
  const marks = exteriorBody?.marks || [];
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>Phân khúc xe: <b>{segmentLabel}</b></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
        {images.map((img, i) => {
          const angle = img.split("-")[1];
          const isLoneLast = i === images.length - 1 && images.length % 2 === 1;
          const cardStyle = isLoneLast ? { gridColumn: "1 / -1", width: "calc(50% - 4px)", margin: "0 auto" } : undefined;
          return (
            <div key={img} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 8, textAlign: "center", background: "var(--surface)", ...cardStyle }}>
              <div style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/vehicle-diagrams/${img}.png`} alt={DIAGRAM_LABELS[angle] || angle} style={{ width: "100%", height: "auto", display: "block" }} />
                {marks.filter((m) => m.diagram === img).map((m) => (
                  <span
                    key={m.id}
                    style={{
                      position: "absolute", left: `${m.xPct}%`, top: `${m.yPct}%`, transform: "translate(-50%, -50%)",
                      color: "#dc2626", fontSize: 20, fontWeight: 900, lineHeight: 1,
                      textShadow: "0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff",
                    }}
                  >
                    ✕
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 6 }}>{DIAGRAM_LABELS[angle] || angle}</div>
            </div>
          );
        })}
      </div>
      <div className={styles.intakeGroupTitle}>Ghi chú tình trạng thân vỏ</div>
      <div className={styles.intakeNoteText}>{exteriorBody?.notes || "—"}</div>
    </div>
  );
}

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

export default function IntakeChecklistView({ value, vehicleModelText }) {
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

      <div className={styles.intakeGroupTitle}>Kiểm tra thân vỏ xe bên ngoài</div>
      <ExteriorBodyView exteriorBody={v.exteriorBody} vehicleModelText={vehicleModelText} />

      <Group title="Kiểm tra khoang động cơ" group="engineBay" fields={ENGINE_BAY_FIELDS} v={v} />

      <div className={styles.intakeGroupTitle}>Lưu ý</div>
      <div className={styles.intakeNoteText}>{v.notes || "—"}</div>
    </div>
  );
}
