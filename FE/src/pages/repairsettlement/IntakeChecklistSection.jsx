// Phiếu tiếp nhận và bàn giao xe - checklist tình trạng xe lúc tiếp nhận,
// số hoá lại từ form giấy cùng tên. Lưu nguyên 1 khối JSON (repair_orders.intake_checklist),
// không tách thành nhiều cột riêng vì đây là checklist tĩnh, không cần truy vấn/báo cáo theo từng mục.
import { useRef } from 'react';
export const DEFAULT_INTAKE_CHECKLIST = {
  interior: { ac: null, handbrake: null, brakePedalClutch: null, seatsHeadliner: null },
  fuelGauge: null, // 'E' | '1/4' | '1/2' | '3/4' | 'F'
  warningLights: '',
  itemsInCar: { charger: null, memoryCardUsb: null, glassesPerfume: null }, // true=Có | false=K | null=chưa chọn
  itemsInCarOther: '',
  exteriorLeftFront: {
    mirrorFrontLeft: null, tireFrontLeft: null, tireRearLeft: null, logoDecals: null,
    windshieldFront: null, wiperFront: null, headlightFrontLeft: null, fogLightLeft: null,
    headlightFrontRight: null, fogLightRight: null,
  },
  exteriorRightRear: {
    mirrorFrontRight: null, tireFrontRight: null, tireRearRight: null, fuelCap: null,
    windshieldRear: null, wiperRear: null, turnSignalRearRight: null, taillightRight: null,
    turnSignalRearLeft: null, spareTireToolkit: null,
  },
  engineBay: {
    battery: null, engineOil: null, coolant: null, washerFluid: null,
    brakeClutchFluid: null, powerSteeringFluid: null, hoseCondition: null, driveBelt: null,
  },
  exteriorBody: { notes: '', marks: [] }, // marks: [{ id, diagram: 'sedan-left', xPct, yPct }] - danh dau vi tri xuoc/mop tren hinh
  // null = chua bam (giong itemsInCar) - tranh nut "K" hien san nhu da chon
  // roi ngay tu dau, dù CVDV chua he dung vao.
  priority: { repairRedo: null, hasAppointment: null, warranty: null },
  otherInfo: { dealerKeepsOldParts: null, returnOldPartsToCustomer: null, carWash: null, customerWaitsAtShop: null },
  notes: '',
};

export const INTERIOR_FIELDS = [
  ['ac', 'Máy lạnh'], ['handbrake', 'Phanh tay'],
  ['brakePedalClutch', 'Bàn đạp phanh / Ly hợp'], ['seatsHeadliner', 'Ghế, la phông'],
];
export const ITEMS_IN_CAR_FIELDS = [
  ['charger', 'Thiết bị sạc'], ['memoryCardUsb', 'Thẻ nhớ, USB'], ['glassesPerfume', 'Mắt kính, nước hoa'],
];
export const EXTERIOR_LEFT_FIELDS = [
  ['mirrorFrontLeft', 'Kính chiếu hậu trước trái'], ['tireFrontLeft', 'Bánh xe trước trái (lốp, mâm xe, vòi xe)'],
  ['tireRearLeft', 'Bánh xe sau trái (lốp, mâm xe, vòi xe)'], ['logoDecals', 'Logo, tem, nhãn'],
  ['windshieldFront', 'Kính chắn gió trước'], ['wiperFront', 'Gạt mưa trước'],
  ['headlightFrontLeft', 'Đèn pha trước trái'], ['fogLightLeft', 'Đèn sương mù trái'],
  ['headlightFrontRight', 'Đèn pha trước phải'], ['fogLightRight', 'Đèn sương mù phải'],
];
export const EXTERIOR_RIGHT_FIELDS = [
  ['mirrorFrontRight', 'Kính chiếu hậu trước phải'], ['tireFrontRight', 'Bánh xe trước phải (lốp, mâm xe, vòi xe)'],
  ['tireRearRight', 'Bánh xe sau phải (lốp, mâm xe, vòi xe)'], ['fuelCap', 'Nắp bình xăng'],
  ['windshieldRear', 'Kính chắn gió sau'], ['wiperRear', 'Gạt mưa sau'],
  ['turnSignalRearRight', 'Đèn báo rẽ sau phải'], ['taillightRight', 'Đèn lái sau phải'],
  ['turnSignalRearLeft', 'Đèn báo rẽ sau trái'], ['spareTireToolkit', 'Lốp dự phòng, bộ dụng cụ đồ nghề'],
];
export const ENGINE_BAY_FIELDS = [
  ['battery', 'Bình điện'], ['engineOil', 'Dầu động cơ'], ['coolant', 'Nước làm mát động cơ'],
  ['washerFluid', 'Nước rửa kính'], ['brakeClutchFluid', 'Dầu phanh/ly hợp'],
  ['powerSteeringFluid', 'Dầu trợ lực lái'], ['hoseCondition', 'Tình trạng các đường ống'], ['driveBelt', 'Dây đai dẫn động'],
];
export const PRIORITY_FIELDS = [
  ['repairRedo', 'Xe sửa chữa lại'], ['hasAppointment', 'Xe có đặt hẹn'], ['warranty', 'Xe bảo hành'],
];
export const OTHER_INFO_FIELDS = [
  ['dealerKeepsOldParts', 'Đại lý giữ phụ tùng cũ trả bảo hành/bảo hiểm'],
  ['returnOldPartsToCustomer', 'Trả phụ tùng cũ cho khách hàng'],
  ['carWash', 'Rửa xe'], ['customerWaitsAtShop', 'Khách hàng chờ tại xưởng'],
];
export const FUEL_GAUGE_OPTIONS = ['E', '1/4', '1/2', '3/4', 'F'];

// Kiem tra than vo xe ben ngoai - so hoa tu file mau "Reference/Phieu tiep
// nhan va ban giao xe.xlsx" (3 sheet Sedan/SUV-HB/Pick-up). Anh so voi 4/5
// goc (trai/phai/truoc/sau/tren) trich thang tu file mau do, luu trong
// FE/public/vehicle-diagrams/. Dung dung 3 phan khuc nhu file mau, KHONG chia
// them Hatchback rieng vi file mau da gop chung "SUV - HB" 1 sheet.
export const SEGMENT_OPTIONS = [
  ['sedan', 'Sedan/Hatchback'],
  ['suv', 'SUV/Crossover'],
  ['pickup', 'Bán tải'],
];
export const SEGMENT_DIAGRAMS = {
  sedan: ['sedan-left', 'sedan-right', 'sedan-front', 'sedan-rear', 'sedan-top'],
  suv: ['suv-left', 'suv-right', 'suv-front', 'suv-rear', 'suv-top'],
  pickup: ['pickup-left', 'pickup-right', 'pickup-front', 'pickup-rear', 'pickup-top'],
};
const DIAGRAM_LABELS = { left: 'Trái', right: 'Phải', front: 'Trước', rear: 'Sau', top: 'Trên' };

// Doan chuoi ten xe (vd "CX-5 2.0 Luxury 2024", "BT-50 1.9 Premium 2022") ->
// doan phan khuc mac dinh, khop dung 3 nhom dong xe Mazda dang ban (CX-* la
// SUV/Crossover, BT-50 la ban tai, con lai - Mazda2/Mazda3/Mazda6 - la
// Sedan/Hatchback). Chi la GOI Y ban dau, CVDV van bam doi thu cong duoc neu
// doan sai (vd xe hang thu 3 khong theo dung quy uoc ten nay).
export function detectSegmentFromModelText(modelText) {
  const t = (modelText || '').toLowerCase();
  if (t.includes('bt-50') || t.includes('bt50')) return 'pickup';
  if (t.includes('cx-') || t.includes('cx60') || t.includes('cx90') || /\bcx\s*\d/.test(t)) return 'suv';
  return 'sedan';
}

// Cac group dung OkNgField/CoKhongField - value mac dinh null (chua bam),
// khac voi checkbox (priority/otherInfo) von co false la 1 dap an hop le san
// - nen chi bat buoc phai bam het cac nut o day, KHONG bat buoc checkbox hay
// cac o nhap van ban (warningLights/itemsInCarOther/notes).
const OK_NG_GROUPS = [
  ['interior', INTERIOR_FIELDS],
  ['exteriorLeftFront', EXTERIOR_LEFT_FIELDS],
  ['exteriorRightRear', EXTERIOR_RIGHT_FIELDS],
  ['engineBay', ENGINE_BAY_FIELDS],
];

export function isIntakeChecklistComplete(v) {
  if (!v) return false;
  for (const [group, fields] of OK_NG_GROUPS) {
    for (const [key] of fields) {
      if (v[group]?.[key] == null) return false;
    }
  }
  for (const [key] of ITEMS_IN_CAR_FIELDS) {
    if (v.itemsInCar?.[key] == null) return false;
  }
  if (!v.fuelGauge) return false;
  return true;
}

const TOGGLE_STYLES = {
  OK: { active: '#16a34a', activeBg: '#16a34a', hoverBg: '#ecfdf5' },
  NG: { active: '#dc2626', activeBg: '#dc2626', hoverBg: '#fef2f2' },
  CO: { active: '#16a34a', activeBg: '#16a34a', hoverBg: '#ecfdf5' },
  KHONG: { active: '#64748b', activeBg: '#64748b', hoverBg: '#f1f5f9' },
};

function PillToggle({ styleKey, text, active, onClick }) {
  const c = TOGGLE_STYLES[styleKey];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? `1px solid ${c.active}` : '1px solid var(--gray-300)',
        borderRadius: 4,
        padding: '5px 0',
        width: 44,
        textAlign: 'center',
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        cursor: 'pointer',
        transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
        background: active ? c.activeBg : '#fff',
        color: active ? '#fff' : '#64748b',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = c.hoverBg; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = '#fff'; }}
    >
      {text}
    </button>
  );
}

function OkNgField({ label, value, onSet }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <span style={{ fontSize: 12.5, color: '#334155' }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <PillToggle styleKey="OK" text="OK" active={value === 'OK'} onClick={() => onSet(value === 'OK' ? null : 'OK')} />
        <PillToggle styleKey="NG" text="NG" active={value === 'NG'} onClick={() => onSet(value === 'NG' ? null : 'NG')} />
      </div>
    </div>
  );
}

function CoKhongField({ label, value, onSet }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <span style={{ fontSize: 12.5, color: '#334155' }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <PillToggle styleKey="CO" text="Có" active={value === true} onClick={() => onSet(value === true ? null : true)} />
        <PillToggle styleKey="KHONG" text="K" active={value === false} onClick={() => onSet(value === false ? null : false)} />
      </div>
    </div>
  );
}

function FuelGauge({ value, onChange }) {
  const n = FUEL_GAUGE_OPTIONS.length;
  // Chưa chọn thì vẫn hiện tam giác ở vị trí E (mặc định) để gợi ý có thể kéo,
  // nhưng KHÔNG tự set value - phải người dùng bấm/kéo mới thực sự chọn.
  const idx = value ? FUEL_GAUGE_OPTIONS.indexOf(value) : 0;
  const trackRef = useRef(null);
  // E nằm ở mép trái (0%), F ở mép phải (100%) - giống đồng hồ xăng thật,
  // khác với bản trước (chia 5 ô đều nhau, tâm ô lệch khỏi 2 đầu mút).
  const posPct = (i) => (i / (n - 1)) * 100;

  // Kéo theo con trỏ nhưng luôn snap về đúng 1 trong 5 vạch - không cho dừng
  // ở khoảng trống giữa 2 vạch.
  const pickFromClientX = (clientX) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const nearest = Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))));
    onChange(FUEL_GAUGE_OPTIONS[nearest]);
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    pickFromClientX(e.clientX);
    const handleMove = (ev) => pickFromClientX(ev.clientX);
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <div style={{ padding: '4px 0 0' }}>
      <div style={{ position: 'relative', height: 16 }}>
        {FUEL_GAUGE_OPTIONS.map((o, i) => (
          <span
            key={o}
            style={{
              position: 'absolute',
              left: `${posPct(i)}%`,
              transform: i === 0 ? 'translateX(0)' : i === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              fontSize: 12,
              fontWeight: value === o ? 700 : 500,
              color: value === o ? '#334155' : '#64748b',
            }}
          >
            {o}
          </span>
        ))}
      </div>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        style={{
          position: 'relative',
          height: 14,
          marginBottom: 40,
          background: 'linear-gradient(180deg, #f8fafc, #e2e8f0)',
          border: '1px solid var(--gray-400)',
          borderRadius: 3,
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        {FUEL_GAUGE_OPTIONS.map((_, i) => (
          (i > 0 && i < n - 1) && (
            <div
              key={i}
              style={{
                position: 'absolute', top: 0, left: `${posPct(i)}%`, transform: 'translateX(-50%)',
                width: 1, height: '100%', background: 'var(--gray-400)',
              }}
            />
          )
        ))}
        {/* Nút kéo tam giác - vùng chạm to (40px) để bấm giữ + kéo được cả
            trên điện thoại/tablet, không chỉ bấm-chọn từng vạch. */}
        {idx >= 0 && (
          <div
            onPointerDown={handlePointerDown}
            style={{
              position: 'absolute',
              top: '100%',
              left: `${posPct(idx)}%`,
              transform: 'translateX(-50%)',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              cursor: 'grab',
              touchAction: 'none',
              transition: 'left 0.1s ease',
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '11px solid transparent',
                borderRight: '11px solid transparent',
                borderBottom: '16px solid #334155',
                filter: 'drop-shadow(0 -1px 2px rgba(0,0,0,0.25))',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Danh dau vi tri xuoc/mop truc tiep tren tung anh - bam vao dau tren anh la
// them 1 dau X do dung ngay diem do (luu %x/%y theo kich thuoc anh, khong
// theo px, de xem lai van dung vi tri du man hinh khac size). Moi anh 1 the
// rieng, click nao cung day vao CHUNG 1 mang marks (co danh dau anh nao) de
// nut "Xoa gan nhat" (undo) hieu dung "gan nhat" la lan bam gan nhat tren
// TOAN BO 5 anh, khong rieng anh dang xem.
function MarkableImage({ img, label, marks, onAddMark, style }) {
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onAddMark(img, xPct, yPct);
  };
  return (
    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8, textAlign: 'center', background: '#fff', ...style }}>
      <div style={{ position: 'relative', cursor: 'crosshair' }} onClick={handleClick}>
        <img src={`/vehicle-diagrams/${img}.png`} alt={label} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }} draggable={false} />
        {marks.filter((m) => m.diagram === img).map((m) => (
          <span
            key={m.id}
            style={{
              position: 'absolute', left: `${m.xPct}%`, top: `${m.yPct}%`, transform: 'translate(-50%, -50%)',
              color: '#dc2626', fontSize: 22, fontWeight: 900, lineHeight: 1, pointerEvents: 'none',
              textShadow: '0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff',
            }}
          >
            ✕
          </span>
        ))}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-700)', marginTop: 6 }}>{label}</div>
    </div>
  );
}

// Kiem tra than vo xe ben ngoai - hien 5 goc anh so voi cua dung phan khuc,
// phan khuc lay HOAN TOAN tu dong theo o "Loai xe" CVDV da go o tren (khong
// cho chon tay rieng o day nua - tranh 2 nguon su that lech nhau, "Loai xe"
// la duy nhat). Xep 2 anh/dong cho anh to ro. Bam truc tiep len anh de danh
// dau vi tri xuoc/mop (dau X do), kem 2 nut Xoa het/Xoa gan nhat va 1 o ghi
// chu tu do mo ta them.
function ExteriorBodyCheck({ autoSegment, marks, onMarksChange, notes, onNotesChange }) {
  const images = SEGMENT_DIAGRAMS[autoSegment] || SEGMENT_DIAGRAMS.sedan;
  const segmentLabel = SEGMENT_OPTIONS.find(([key]) => key === autoSegment)?.[1] || autoSegment;
  const list = marks || [];

  const addMark = (diagram, xPct, yPct) => {
    onMarksChange([...list, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, diagram, xPct, yPct }]);
  };
  const clearAll = () => onMarksChange([]);
  const undoLast = () => onMarksChange(list.slice(0, -1));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
          Phân khúc xe: <b style={{ color: 'var(--primary-dark)' }}>{segmentLabel}</b>
          <span style={{ marginLeft: 10, fontStyle: 'italic', color: 'var(--gray-400)' }}>Đánh dấu lên hình để ghi lại vị trí xước/móp của xe</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={list.length === 0} onClick={undoLast}>
            Xóa dấu gần nhất
          </button>
          <button type="button" className="btn btn-danger btn-sm" disabled={list.length === 0} onClick={clearAll}>
            Xóa hết dấu
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
        {images.map((img, i) => {
          const angle = img.split('-')[1];
          // Anh cuoi le loi 1 minh 1 dong (5 anh/2 cot) - cho no chiem het
          // dong roi tu can giua, khong de dinh sang trai trong khi ben phai
          // trong khong.
          const isLoneLast = i === images.length - 1 && images.length % 2 === 1;
          const style = isLoneLast ? { gridColumn: '1 / -1', width: 'calc(50% - 5px)', margin: '0 auto' } : undefined;
          return (
            <MarkableImage
              key={img} img={img} label={DIAGRAM_LABELS[angle] || angle} marks={list} onAddMark={addMark} style={style}
            />
          );
        })}
      </div>
      <div className="form-group">
        <label className="form-label">Ghi chú tình trạng thân vỏ (vết xước, móp, vị trí cụ thể...)</label>
        <textarea className="form-textarea" rows={2} value={notes || ''} onChange={(e) => onNotesChange(e.target.value)} placeholder="Mô tả vị trí, mức độ (nếu có)" />
      </div>
    </div>
  );
}

// open/onToggle: do man Phieu quyet toan giu (xem CollapsibleCard trong
// RepairSettlementPage) de gap/mo khung nay giong 2 khung con lai. Noi dung
// chi bi an bang display:none, KHONG unmount - giu nguyen cac o da tick.
export default function IntakeChecklistSection({ value, onChange, vehicleModelText, open = true, onToggle }) {
  const v = value || DEFAULT_INTAKE_CHECKLIST;
  const autoSegment = detectSegmentFromModelText(vehicleModelText);

  const setGroupField = (group, key, val) => {
    onChange({ ...v, [group]: { ...v[group], [key]: val } });
  };
  const setField = (key, val) => {
    onChange({ ...v, [key]: val });
  };

  const renderOkNgGroup = (group, fields) => (
    <div>
      {fields.map(([key, label]) => (
        <OkNgField key={key} label={label} value={v[group]?.[key] ?? null} onSet={(val) => setGroupField(group, key, val)} />
      ))}
    </div>
  );

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={onToggle} aria-expanded={open}
          title={open ? 'Thu gọn' : 'Mở rộng'}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none',
            padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit',
          }}>
          <span style={{
            fontSize: 11, color: 'var(--gray-500)', width: 16, textAlign: 'center',
            transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none',
          }}>▶</span>
          <span className="card-title">Tiếp nhận và bàn giao xe</span>
        </button>
        <span style={{ fontSize: 12, color: '#000' }}>(Diễn giải: OK: Tốt / NG: Không tốt / K: Không)</span>
      </div>
      <div className="card-body" style={open ? undefined : { display: 'none' }}>
        <div className="form-section-title" style={{ marginTop: 0 }}>Kiểm tra nội thất</div>
        <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
          {renderOkNgGroup('interior', INTERIOR_FIELDS)}
          <div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Mức nhiên liệu</label>
              <FuelGauge value={v.fuelGauge || null} onChange={(val) => setField('fuelGauge', val)} />
            </div>
            <div className="form-group">
              <label className="form-label">Đèn cảnh báo / chỉ báo bất thường</label>
              <input className="form-input" value={v.warningLights || ''} onChange={(e) => setField('warningLights', e.target.value)} placeholder="Mô tả đèn cảnh báo (nếu có)" />
            </div>
          </div>
        </div>

        <div className="form-section-title">Vật dụng trong xe</div>
        <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
          <div>
            {ITEMS_IN_CAR_FIELDS.map(([key, label]) => (
              <CoKhongField key={key} label={label} value={v.itemsInCar?.[key] ?? null} onSet={(val) => setGroupField('itemsInCar', key, val)} />
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Vật dụng khác</label>
            <input className="form-input" value={v.itemsInCarOther || ''} onChange={(e) => setField('itemsInCarOther', e.target.value)} />
          </div>
        </div>

        <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
          <div>
            <div className="form-section-title">Kiểm tra bên trái, phía trước xe</div>
            {renderOkNgGroup('exteriorLeftFront', EXTERIOR_LEFT_FIELDS)}
          </div>
          <div>
            <div className="form-section-title">Kiểm tra bên phải, phía sau xe</div>
            {renderOkNgGroup('exteriorRightRear', EXTERIOR_RIGHT_FIELDS)}
          </div>
        </div>

        <div className="form-section-title">Kiểm tra thân vỏ xe bên ngoài</div>
        <div style={{ marginBottom: 12 }}>
          <ExteriorBodyCheck
            autoSegment={autoSegment}
            marks={v.exteriorBody?.marks}
            onMarksChange={(val) => setGroupField('exteriorBody', 'marks', val)}
            notes={v.exteriorBody?.notes}
            onNotesChange={(val) => setGroupField('exteriorBody', 'notes', val)}
          />
        </div>

        <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
          <div>
            <div className="form-section-title" style={{ marginTop: 0 }}>Kiểm tra khoang động cơ</div>
            {renderOkNgGroup('engineBay', ENGINE_BAY_FIELDS)}
          </div>
          <div>
            <div className="form-section-title" style={{ marginTop: 0 }}>Mức độ ưu tiên</div>
            {PRIORITY_FIELDS.map(([key, label]) => (
              <CoKhongField key={key} label={label} value={v.priority?.[key] ?? null} onSet={(val) => setGroupField('priority', key, val)} />
            ))}
            <div className="form-section-title">Thông tin khác</div>
            {OTHER_INFO_FIELDS.map(([key, label]) => (
              <CoKhongField key={key} label={label} value={v.otherInfo?.[key] ?? null} onSet={(val) => setGroupField('otherInfo', key, val)} />
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Lưu ý (hạng mục cần làm sớm, ghi chú)</label>
          <textarea className="form-textarea" rows={2} value={v.notes || ''} onChange={(e) => setField('notes', e.target.value)} />
        </div>
      </div>
    </div>
  );
}
