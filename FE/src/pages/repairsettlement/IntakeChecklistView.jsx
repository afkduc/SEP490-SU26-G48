// Ban chi-xem (read-only) cua "Phieu tiep nhan va ban giao xe" - dung trong
// cac man xem chi tiet phieu quyet toan. Tach rieng khoi IntakeChecklistSection
// (ban chinh sua) vi khong can bat ky state/tuong tac nao, chi render gia tri.
import {
  DEFAULT_INTAKE_CHECKLIST,
  INTERIOR_FIELDS, ITEMS_IN_CAR_FIELDS, EXTERIOR_LEFT_FIELDS, EXTERIOR_RIGHT_FIELDS,
  ENGINE_BAY_FIELDS, PRIORITY_FIELDS, OTHER_INFO_FIELDS, FUEL_GAUGE_OPTIONS,
  SEGMENT_OPTIONS, SEGMENT_DIAGRAMS, detectSegmentFromModelText,
} from './IntakeChecklistSection';

const BADGE_COLORS = {
  OK: { bg: '#ecfdf5', fg: '#16a34a' },
  NG: { bg: '#fef2f2', fg: '#dc2626' },
  CO: { bg: '#ecfdf5', fg: '#16a34a' },
  KHONG: { bg: '#f1f5f9', fg: '#64748b' },
};

function ValueBadge({ styleKey, text }) {
  const c = BADGE_COLORS[styleKey];
  return (
    <span style={{ display: 'inline-block', minWidth: 32, textAlign: 'center', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: c.bg, color: c.fg }}>
      {text}
    </span>
  );
}

function OkNgRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <span style={{ fontSize: 12.5, color: '#334155' }}>{label}</span>
      {value === 'OK' && <ValueBadge styleKey="OK" text="OK" />}
      {value === 'NG' && <ValueBadge styleKey="NG" text="NG" />}
      {value !== 'OK' && value !== 'NG' && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>—</span>}
    </div>
  );
}

function CoKhongRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <span style={{ fontSize: 12.5, color: '#334155' }}>{label}</span>
      {value === true && <ValueBadge styleKey="CO" text="Có" />}
      {value === false && <ValueBadge styleKey="KHONG" text="K" />}
      {value !== true && value !== false && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>—</span>}
    </div>
  );
}

function FuelGaugeView({ value }) {
  const n = FUEL_GAUGE_OPTIONS.length;
  const idx = value ? FUEL_GAUGE_OPTIONS.indexOf(value) : -1;
  const posPct = (i) => (i / (n - 1)) * 100;
  return (
    <div>
      <div style={{ position: 'relative', height: 16 }}>
        {FUEL_GAUGE_OPTIONS.map((o, i) => (
          <span key={o} style={{
            position: 'absolute', left: `${posPct(i)}%`,
            transform: i === 0 ? 'translateX(0)' : i === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            fontSize: 12, fontWeight: value === o ? 700 : 500, color: value === o ? '#334155' : '#64748b',
          }}>
            {o}
          </span>
        ))}
      </div>
      <div style={{ position: 'relative', height: 14, marginTop: 4, background: 'linear-gradient(180deg, #f8fafc, #e2e8f0)', border: '1px solid var(--gray-400)', borderRadius: 3 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: `${posPct(i)}%`, transform: 'translateX(-50%)', width: 1, height: '100%', background: 'var(--gray-400)' }} />
        ))}
        {idx >= 0 && (
          <div style={{ position: 'absolute', top: '100%', left: `${posPct(idx)}%`, transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '10px solid #334155', marginTop: 2 }} />
        )}
      </div>
    </div>
  );
}

const DIAGRAM_LABELS = { left: 'Trái', right: 'Phải', front: 'Trước', rear: 'Sau', top: 'Trên' };

// Anh tinh (khong bam danh dau duoc, chi xem lai vi tri da danh dau).
function DiagramImage({ img, label, marks }) {
  return (
    <div style={{ position: 'relative' }}>
      <img src={`/vehicle-diagrams/${img}.png`} alt={label} style={{ width: '100%', height: 'auto', display: 'block' }} />
      {marks.filter((m) => m.diagram === img).map((m) => (
        <span
          key={m.id}
          style={{
            position: 'absolute', left: `${m.xPct}%`, top: `${m.yPct}%`, transform: 'translate(-50%, -50%)',
            color: '#dc2626', fontSize: 22, fontWeight: 900, lineHeight: 1,
            textShadow: '0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff',
          }}
        >
          ✕
        </span>
      ))}
    </div>
  );
}

function ExteriorBodyView({ exteriorBody, vehicleModelText }) {
  const segment = detectSegmentFromModelText(vehicleModelText);
  const images = SEGMENT_DIAGRAMS[segment] || SEGMENT_DIAGRAMS.sedan;
  const segmentLabel = SEGMENT_OPTIONS.find(([key]) => key === segment)?.[1] || segment;
  const marks = exteriorBody?.marks || [];
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 10 }}>Phân khúc xe: <b>{segmentLabel}</b></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
        {images.map((img, i) => {
          const angle = img.split('-')[1];
          const isLoneLast = i === images.length - 1 && images.length % 2 === 1;
          const cardStyle = isLoneLast ? { gridColumn: '1 / -1', width: 'calc(50% - 5px)', margin: '0 auto' } : undefined;
          return (
            <div key={img} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8, textAlign: 'center', background: '#fff', ...cardStyle }}>
              <DiagramImage img={img} label={DIAGRAM_LABELS[angle] || angle} marks={marks} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-700)', marginTop: 6 }}>{DIAGRAM_LABELS[angle] || angle}</div>
            </div>
          );
        })}
      </div>
      <div className="form-group">
        <label className="form-label">Ghi chú tình trạng thân vỏ</label>
        <div style={{ fontSize: 12.5, color: exteriorBody?.notes ? '#334155' : 'var(--gray-400)', whiteSpace: 'pre-wrap' }}>{exteriorBody?.notes || '—'}</div>
      </div>
    </div>
  );
}

export default function IntakeChecklistView({ value, vehicleModelText }) {
  const v = value || DEFAULT_INTAKE_CHECKLIST;

  const renderOkNgGroup = (group, fields) => (
    <div>
      {fields.map(([key, label]) => (
        <OkNgRow key={key} label={label} value={v[group]?.[key] ?? null} />
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 12, color: '#000', marginBottom: 12 }}>(Diễn giải: OK: Tốt / NG: Không tốt / K: Không)</div>

      <div className="form-section-title" style={{ marginTop: 0 }}>Kiểm tra nội thất</div>
      {renderOkNgGroup('interior', INTERIOR_FIELDS)}

      <div className="form-group" style={{ marginTop: 12, marginBottom: 10 }}>
        <label className="form-label">Mức nhiên liệu</label>
        <FuelGaugeView value={v.fuelGauge || null} />
      </div>
      <div className="form-group">
        <label className="form-label">Đèn cảnh báo / chỉ báo bất thường</label>
        <div style={{ fontSize: 12.5, color: v.warningLights ? '#334155' : 'var(--gray-400)' }}>{v.warningLights || '—'}</div>
      </div>

      <div className="form-section-title">Vật dụng trong xe</div>
      {ITEMS_IN_CAR_FIELDS.map(([key, label]) => (
        <CoKhongRow key={key} label={label} value={v.itemsInCar?.[key] ?? null} />
      ))}
      <div className="form-group" style={{ marginTop: 10 }}>
        <label className="form-label">Vật dụng khác</label>
        <div style={{ fontSize: 12.5, color: v.itemsInCarOther ? '#334155' : 'var(--gray-400)' }}>{v.itemsInCarOther || '—'}</div>
      </div>

      <div className="form-section-title">Kiểm tra bên trái, phía trước xe</div>
      {renderOkNgGroup('exteriorLeftFront', EXTERIOR_LEFT_FIELDS)}

      <div className="form-section-title">Kiểm tra bên phải, phía sau xe</div>
      {renderOkNgGroup('exteriorRightRear', EXTERIOR_RIGHT_FIELDS)}

      <div className="form-section-title">Kiểm tra thân vỏ xe bên ngoài</div>
      <ExteriorBodyView exteriorBody={v.exteriorBody} vehicleModelText={vehicleModelText} />

      <div className="form-section-title">Kiểm tra khoang động cơ</div>
      {renderOkNgGroup('engineBay', ENGINE_BAY_FIELDS)}

      <div className="form-section-title">Mức độ ưu tiên</div>
      {PRIORITY_FIELDS.map(([key, label]) => (
        <CoKhongRow key={key} label={label} value={v.priority?.[key] ?? null} />
      ))}

      <div className="form-section-title">Thông tin khác</div>
      {OTHER_INFO_FIELDS.map(([key, label]) => (
        <CoKhongRow key={key} label={label} value={v.otherInfo?.[key] ?? null} />
      ))}

      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">Lưu ý (hạng mục cần làm sớm, ghi chú)</label>
        <div style={{ fontSize: 12.5, color: v.notes ? '#334155' : 'var(--gray-400)', whiteSpace: 'pre-wrap' }}>{v.notes || '—'}</div>
      </div>
    </div>
  );
}
