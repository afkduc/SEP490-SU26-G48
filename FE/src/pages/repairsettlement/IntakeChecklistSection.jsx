// Phiếu tiếp nhận và bàn giao xe - checklist tình trạng xe lúc tiếp nhận,
// số hoá lại từ form giấy cùng tên. Lưu nguyên 1 khối JSON (service_orders.intake_checklist),
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
  priority: { repairRedo: false, hasAppointment: false, warranty: false },
  otherInfo: { dealerKeepsOldParts: false, returnOldPartsToCustomer: false, carWash: false, customerWaitsAtShop: false },
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
  OK: { active: '#3f3f46', activeBg: '#3f3f46', hoverBg: '#f4f4f5' },
  NG: { active: '#27272a', activeBg: '#27272a', hoverBg: '#e4e4e7' },
  CO: { active: '#3f3f46', activeBg: '#3f3f46', hoverBg: '#f4f4f5' },
  KHONG: { active: '#71717a', activeBg: '#71717a', hoverBg: '#f4f4f5' },
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
        padding: '5px 14px',
        minWidth: 44,
        textAlign: 'center',
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        cursor: 'pointer',
        transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
        background: active ? c.activeBg : '#fff',
        color: active ? '#fff' : '#71717a',
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
      <span style={{ fontSize: 12.5, color: '#3f3f46' }}>{label}</span>
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
      <span style={{ fontSize: 12.5, color: '#3f3f46' }}>{label}</span>
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
              color: value === o ? '#3f3f46' : '#71717a',
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
          background: 'linear-gradient(180deg, #fafafa, #e4e4e7)',
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
                borderBottom: '16px solid #3f3f46',
                filter: 'drop-shadow(0 -1px 2px rgba(0,0,0,0.25))',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CheckField({ label, checked, onToggle }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12.5, cursor: 'pointer',
        borderBottom: '1px solid var(--gray-100)', color: '#3f3f46',
      }}
    >
      <input type="checkbox" checked={Boolean(checked)} onChange={() => onToggle(!checked)} />
      {label}
    </label>
  );
}

export default function IntakeChecklistSection({ value, onChange }) {
  const v = value || DEFAULT_INTAKE_CHECKLIST;

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
      <div className="card-header" style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="card-title">Phiếu tiếp nhận và bàn giao xe</span>
        <span style={{ fontSize: 12, color: '#000' }}>(Diễn giải: OK: Tốt / NG: Không tốt / K: Không)</span>
      </div>
      <div className="card-body">
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

        <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
          <div>
            <div className="form-section-title" style={{ marginTop: 0 }}>Kiểm tra khoang động cơ</div>
            {renderOkNgGroup('engineBay', ENGINE_BAY_FIELDS)}
          </div>
          <div>
            <div className="form-section-title" style={{ marginTop: 0 }}>Mức độ ưu tiên</div>
            {PRIORITY_FIELDS.map(([key, label]) => (
              <CheckField key={key} label={label} checked={v.priority?.[key]} onToggle={(val) => setGroupField('priority', key, val)} />
            ))}
            <div className="form-section-title">Thông tin khác</div>
            {OTHER_INFO_FIELDS.map(([key, label]) => (
              <CheckField key={key} label={label} checked={v.otherInfo?.[key]} onToggle={(val) => setGroupField('otherInfo', key, val)} />
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
