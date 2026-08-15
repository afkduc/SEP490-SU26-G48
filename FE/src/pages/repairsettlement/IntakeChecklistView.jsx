// Ban chi-xem (read-only) cua "Phieu tiep nhan va ban giao xe" - dung trong
// cac man xem chi tiet phieu quyet toan. Tach rieng khoi IntakeChecklistSection
// (ban chinh sua) vi khong can bat ky state/tuong tac nao, chi render gia tri.
import {
  DEFAULT_INTAKE_CHECKLIST,
  INTERIOR_FIELDS, ITEMS_IN_CAR_FIELDS, EXTERIOR_LEFT_FIELDS, EXTERIOR_RIGHT_FIELDS,
  ENGINE_BAY_FIELDS, FUEL_GAUGE_OPTIONS,
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

export default function IntakeChecklistView({ value }) {
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

      <div className="form-section-title">Kiểm tra khoang động cơ</div>
      {renderOkNgGroup('engineBay', ENGINE_BAY_FIELDS)}

      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">Lưu ý (hạng mục cần làm sớm, ghi chú)</label>
        <div style={{ fontSize: 12.5, color: v.notes ? '#334155' : 'var(--gray-400)', whiteSpace: 'pre-wrap' }}>{v.notes || '—'}</div>
      </div>
    </div>
  );
}
