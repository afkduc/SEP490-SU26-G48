/**
 * Gom them/sua/khoa 1 doi tuong vao 1 log (giong phieu quyet toan).
 * Ham thuan — khong dung DB, de test.
 */

function parseJsonSafe(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function actionToStep(action) {
  const a = String(action || '').toUpperCase();
  if (a === 'CREATE') return { step: 'created', label: 'Tạo mới' };
  if (a === 'DELETE' || a === 'DISABLE') return { step: 'locked', label: 'Khóa / ngừng hoạt động' };
  if (a === 'REACTIVATE') return { step: 'reactivated', label: 'Kích hoạt lại' };
  return { step: 'updated', label: 'Cập nhật' };
}

/**
 * @param {{ kind: 'create'|'update'|'delete', data?: object, description?: string }} opts
 */
function inferEntityLifecycleStep({ kind, data, description } = {}) {
  if (kind === 'create') {
    return { step: 'created', stepLabel: 'Tạo mới', action: 'CREATE' };
  }
  if (kind === 'delete') {
    return { step: 'locked', stepLabel: 'Khóa / ngừng hoạt động', action: 'DELETE' };
  }

  const desc = String(description || '');
  if (/thành viên đội/i.test(desc)) {
    return { step: 'team_members', stepLabel: 'Cập nhật thành viên đội', action: 'UPDATE' };
  }
  if (/khoang xe/i.test(desc)) {
    return { step: 'bays', stepLabel: 'Cập nhật khoang xe phụ trách', action: 'UPDATE' };
  }
  if (/vô hiệu hóa|ngừng hoạt động|khóa tài khoản|deactivat/i.test(desc)) {
    return { step: 'locked', stepLabel: 'Khóa / ngừng hoạt động', action: 'DELETE' };
  }
  if (/kích hoạt lại|reactiv/i.test(desc)) {
    return { step: 'reactivated', stepLabel: 'Kích hoạt lại', action: 'UPDATE' };
  }
  if (/từ chối/i.test(desc)) {
    return { step: 'rejected', stepLabel: 'Từ chối', action: 'UPDATE' };
  }
  if (/duyệt/i.test(desc)) {
    return { step: 'approved', stepLabel: 'Duyệt', action: 'UPDATE' };
  }
  if (/gán vai trò|gan vai tro/i.test(desc)) {
    return { step: 'role_assigned', stepLabel: 'Gán vai trò', action: 'UPDATE' };
  }
  if (/thu hồi vai trò|xóa vai trò|xoa vai tro/i.test(desc)) {
    return { step: 'role_revoked', stepLabel: 'Thu hồi vai trò', action: 'UPDATE' };
  }
  if (/đặt lại mật khẩu|dat lai mat khau|reset.*password/i.test(desc)) {
    return { step: 'password_reset', stepLabel: 'Đặt lại mật khẩu', action: 'UPDATE' };
  }
  if (/đổi mật khẩu|doi mat khau|change.*password/i.test(desc)) {
    return { step: 'password_changed', stepLabel: 'Đổi mật khẩu', action: 'UPDATE' };
  }
  if (/nghỉ việc|nghi viec/i.test(desc)) {
    return { step: 'locked', stepLabel: 'Khóa / ngừng hoạt động', action: 'DELETE' };
  }
  if (/gán giám đốc|gan giam doc/i.test(desc)) {
    return { step: 'manager_assigned', stepLabel: 'Gán giám đốc chi nhánh', action: 'UPDATE' };
  }
  if (/ngừng áp dụng|ngung ap dung/i.test(desc)) {
    return { step: 'locked', stepLabel: 'Khóa / ngừng hoạt động', action: 'DELETE' };
  }

  const obj = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined);
  const statusOnly = keys.length > 0
    && keys.every((k) => /^(status|isActive|is_active)$/i.test(k));
  if (statusOnly) {
    const status = String(obj.status || '').toLowerCase();
    const active = obj.isActive ?? obj.is_active;
    if (active === false || status === 'inactive') {
      return { step: 'locked', stepLabel: 'Khóa / ngừng hoạt động', action: 'DELETE' };
    }
    if (active === true || status === 'active') {
      return { step: 'reactivated', stepLabel: 'Kích hoạt lại', action: 'UPDATE' };
    }
    if (status === 'approved') return { step: 'approved', stepLabel: 'Duyệt', action: 'UPDATE' };
    if (status === 'rejected') return { step: 'rejected', stepLabel: 'Từ chối', action: 'UPDATE' };
  }

  return { step: 'updated', stepLabel: 'Cập nhật', action: 'UPDATE' };
}

/**
 * Lay steps + snapshot tu log cu (lifecycle hoac nhieu dong CRUD rac).
 */
function seedLifecycleFromExisting(existing, siblings = []) {
  const payload = parseJsonSafe(existing?.new_value);
  if (payload && payload.lifecycle === true) {
    return {
      steps: Array.isArray(payload.steps) ? payload.steps : [],
      snapshot: payload.snapshot && typeof payload.snapshot === 'object' && !Array.isArray(payload.snapshot)
        ? payload.snapshot
        : {},
    };
  }

  const rows = siblings.length ? siblings : (existing ? [existing] : []);
  const steps = rows.map((row) => {
    const mapped = actionToStep(row.action);
    const at = row.logged_at ? new Date(row.logged_at).toISOString() : null;
    return {
      step: mapped.step,
      label: mapped.label,
      at: Number.isNaN(Date.parse(at)) ? null : at,
      by: row.user_name || null,
      description: row.description || mapped.label,
    };
  });

  let snapshot = {};
  const last = rows[rows.length - 1];
  const lastPayload = parseJsonSafe(last?.new_value);
  if (lastPayload?.snapshot && typeof lastPayload.snapshot === 'object' && !Array.isArray(lastPayload.snapshot)) {
    snapshot = lastPayload.snapshot;
  } else if (lastPayload && typeof lastPayload === 'object' && !Array.isArray(lastPayload) && !lastPayload.lifecycle) {
    snapshot = lastPayload;
  }
  return { steps, snapshot };
}

function buildLifecycleDescription(baseDescription, stepLabels) {
  const base = String(baseDescription || '').trim();
  const labels = Array.isArray(stepLabels) ? stepLabels.filter(Boolean) : [];
  if (labels.length <= 1) return base;
  if (/Lịch sử:/i.test(base)) return base;
  return `${base} — Lịch sử: ${labels.join(' → ')}`;
}

/** Khi co ten thi khong dua ID thô vao diff (tranh highlight rac). */
const ID_TO_NAME_FIELD = {
  specialtyIds: 'specialtyNames',
  specialty_ids: 'specialtyNames',
  memberIds: 'memberNames',
  member_ids: 'memberNames',
  roleId: 'roleName',
  role_id: 'roleName',
  branchId: 'branchName',
  branch_id: 'branchName',
  productId: 'productName',
  product_id: 'productName',
  teamLeaderId: 'teamLeaderName',
  team_leader_id: 'teamLeaderName',
  technicianIds: 'technicianNames',
  technician_ids: 'technicianNames',
  categoryId: 'categoryName',
  category_id: 'categoryName',
  newCustomerId: 'newCustomerName',
  brandId: 'brandName',
  brand_id: 'brandName',
};

/** Buoc luon ghi log du snapshot khong doi (hanh dong co nghia). */
const ALWAYS_WRITE_LIFECYCLE_STEPS = new Set([
  'created',
  'signed',
  'paid',
  'printed',
  'assigned',
  'reassigned',
  'completed',
  'password_changed',
  'password_reset',
  'force_logout',
  'role_assigned',
  'role_revoked',
  'approved',
  'rejected',
  'manager_assigned',
  'deleted',
]);

function stableSerialize(value) {
  if (value === undefined) return undefined;
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value.trim());
  if (Array.isArray(value)) {
    const allScalar = value.every(
      (v) => v == null || ['string', 'number', 'boolean'].includes(typeof v),
    );
    if (allScalar) {
      const norm = value
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter((v) => v !== '')
        .map((v) => {
          const n = Number(v);
          return Number.isFinite(n) && String(n) === v ? n : v;
        });
      const sorted = [...norm].sort((a, b) => String(a).localeCompare(String(b), 'en'));
      return JSON.stringify(sorted);
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function auditValuesEqual(a, b) {
  if (a === b) return true;
  const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
  if (empty(a) && empty(b)) return true;
  if (empty(a) || empty(b)) return false;
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Boolean(a) === Boolean(b);
  }
  const na = Number(a);
  const nb = Number(b);
  if (
    Number.isFinite(na)
    && Number.isFinite(nb)
    && String(a).trim() !== ''
    && String(b).trim() !== ''
    && !Number.isNaN(na)
    && !Number.isNaN(nb)
    && (typeof a === 'number' || typeof b === 'number' || /^-?\d+(\.\d+)?$/.test(String(a).trim()))
  ) {
    return na === nb;
  }
  return stableSerialize(a) === stableSerialize(b);
}

/**
 * Diff chi cac field co trong afterPartial (payload buoc nay), so voi beforeSnap.
 * Bo ID khi da co truong ten tuong ung.
 * @returns {Record<string, { old: any, new: any }>}
 */
function diffAuditFields(beforeSnap, afterPartial, explicitOld = null) {
  const after = afterPartial && typeof afterPartial === 'object' && !Array.isArray(afterPartial)
    ? afterPartial
    : {};
  const before = beforeSnap && typeof beforeSnap === 'object' && !Array.isArray(beforeSnap)
    ? beforeSnap
    : {};
  const oldBase = explicitOld && typeof explicitOld === 'object' && !Array.isArray(explicitOld)
    ? { ...before, ...explicitOld }
    : before;

  const changes = {};
  for (const key of Object.keys(after)) {
    if (after[key] === undefined) continue;
    if (key.startsWith('_')) continue;
    const nameTwin = ID_TO_NAME_FIELD[key];
    if (nameTwin && after[nameTwin] !== undefined && after[nameTwin] !== null && after[nameTwin] !== '') {
      continue;
    }
    const oldVal = Object.prototype.hasOwnProperty.call(oldBase, key) ? oldBase[key] : null;
    const newVal = after[key];
    if (auditValuesEqual(oldVal, newVal)) continue;
    changes[key] = { old: oldVal == null ? null : oldVal, new: newVal == null ? null : newVal };
  }
  return changes;
}

function shouldSkipUnchangedLifecycleStep(step, changes) {
  if (ALWAYS_WRITE_LIFECYCLE_STEPS.has(String(step || ''))) return false;
  return !changes || Object.keys(changes).length === 0;
}

module.exports = {
  inferEntityLifecycleStep,
  seedLifecycleFromExisting,
  buildLifecycleDescription,
  parseJsonSafe,
  actionToStep,
  auditValuesEqual,
  diffAuditFields,
  shouldSkipUnchangedLifecycleStep,
  ALWAYS_WRITE_LIFECYCLE_STEPS,
  ID_TO_NAME_FIELD,
  stableSerialize,
};
