import { useMemo, useState } from 'react';
import {
  humanizeAuditDescription,
  summarizeAuditNewValue,
  summarizeAuditObjectRows,
  formatSettlementItems,
  formatAuditTime,
  parseAuditJson,
  getAuditActionLabel,
  getHttpMethodLabel,
  getResponseStatusLabel,
  getResponseStatusTone,
  getResponseStatusDetail,
  formatEntityCodeDisplay,
  formatDurationMs,
  humanizeRequestUrl,
  isSameAuditPayload,
  isAuditSignatureValue,
  getLifecycleSteps,
  enrichAuditDisplaySource,
  AUDIT_TABLE_LABELS,
} from '../../utils/auditDisplay';
import { formatPhoneDisplay } from '../../utils/validation';

const TABLE_NAME_VI = AUDIT_TABLE_LABELS;

export const ACTION_CLASS = {
  CREATE: 'badge--success',
  UPDATE: 'badge--info',
  DELETE: 'badge--danger',
  READ: 'badge--slate',
  LOGIN: 'badge--purple',
  FAILED_LOGIN: 'badge--danger',
  LOGOUT: 'badge--secondary',
  FORCE_LOGOUT: 'badge--orange',
  FORCE_LOGO: 'badge--orange',
  CHANGE_PASSWORD: 'badge--teal',
  RESET_PASSWORD: 'badge--cyan',
  ASSIGN_ROLE: 'badge--indigo',
  REMOVE_ROLE: 'badge--rose',
  EXPORT: 'badge--green',
  IMPORT: 'badge--amber',
  GRANT_SCREEN: 'badge--success',
  REVOKE_SCREEN: 'badge--danger',
  BULK_TOGGLE: 'badge--info',
  SAVE_SCREEN_MATRIX: 'badge--indigo',
  SAVE_USER_SCREEN_PERMISSIONS: 'badge--teal',
  CLEAR_USER_SCREEN_PERMISSIONS: 'badge--rose',
  APPROVE_PERMISSION_REQUEST: 'badge--success',
  REJECT_PERMISSION_REQUEST: 'badge--danger',
  APPROVE_LOGIN_CHALLENGE: 'badge--success',
  REJECT_LOGIN_CHALLENGE: 'badge--danger',
};

function formatLocal(value) {
  return formatAuditTime(value);
}

function JsonView({ data }) {
  if (!data) return <span className="audit-detail__json-empty">—</span>;
  try {
    const obj = typeof data === 'string' ? JSON.parse(data) : data;
    return <pre className="audit-detail__json">{JSON.stringify(obj, null, 2)}</pre>;
  } catch {
    return <span className="audit-detail__json-empty">{String(data)}</span>;
  }
}

function formatMoneyCell(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('vi-VN')} ₫`;
}

function parseItemsList(items) {
  return Array.isArray(items) ? items : parseAuditJson(items) || [];
}

function itemFingerprint(item) {
  if (!item || typeof item !== 'object') return String(item ?? '');
  const name = item.description || item.productName || item.name || '';
  const code = item.code || item.productCode || '';
  const qty = item.qty ?? item.quantity ?? '';
  const unit = item.unit || '';
  const unitPrice = item.unitPrice ?? '';
  const total = item.total ?? '';
  return [name, code, qty, unit, unitPrice, total, item.isFree ? 1 : 0].join('|');
}

function SettlementItemCard({ item, index }) {
  if (!item) return <div className="audit-detail__item-card is-empty">—</div>;
  const name = item.description || item.productName || item.name || `Hạng mục ${index + 1}`;
  const code = item.code || item.productCode || null;
  const qty = item.qty != null ? item.qty : item.quantity;
  const hasPrice = item.unitPrice != null || item.total != null;
  return (
    <div className={`audit-detail__item-card${item.isGroupParent ? ' is-group' : ''}`}>
      <div className="audit-detail__item-card-name">
        <span className="audit-detail__item-idx">{index + 1}.</span>
        <span>{name}</span>
        {item.isFree ? <span className="audit-detail__item-tag">Miễn phí</span> : null}
      </div>
      <div className="audit-detail__item-meta">
        <span>Mã: {code || '—'}</span>
        <span>
          SL: {qty != null ? qty : '—'}
          {item.unit ? ` ${item.unit}` : ''}
        </span>
        <span>Đơn giá: {hasPrice ? formatMoneyCell(item.unitPrice) : '—'}</span>
        <span>Thành tiền: {hasPrice ? formatMoneyCell(item.total) : '—'}</span>
      </div>
    </div>
  );
}

function SettlementItemsTable({ items }) {
  const list = parseItemsList(items);
  if (!list.length) return <span className="audit-detail__json-empty">—</span>;
  return (
    <div className="audit-detail__item-list">
      {list.map((item, index) => (
        <SettlementItemCard key={`${item?.code || 'i'}-${index}`} item={item} index={index} />
      ))}
    </div>
  );
}

function SettlementItemsSplit({ oldItems, newItems }) {
  const oldList = parseItemsList(oldItems);
  const newList = parseItemsList(newItems);
  const max = Math.max(oldList.length, newList.length, 1);
  const pairs = Array.from({ length: max }, (_, index) => {
    const oldItem = oldList[index] || null;
    const newItem = newList[index] || null;
    return {
      index,
      oldItem,
      newItem,
      changed: itemFingerprint(oldItem) !== itemFingerprint(newItem),
    };
  });

  return (
    <div className="audit-detail__split audit-detail__split--items">
      <div className="audit-detail__split-head">
        <div>Hạng mục</div>
        <div>Giá trị cũ</div>
        <div>Giá trị mới</div>
      </div>
      {pairs.map((pair) => (
        <div
          key={pair.index}
          className={`audit-detail__split-row${pair.changed ? ' is-changed' : ''}`}
        >
          <div className="diff-label">#{pair.index + 1}</div>
          <div className={pair.changed ? 'diff-old' : 'diff-same'}>
            <SettlementItemCard item={pair.oldItem} index={pair.index} />
          </div>
          <div className={pair.changed ? 'diff-new' : 'diff-same'}>
            <SettlementItemCard item={pair.newItem} index={pair.index} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditSignatureBlock({ raw }) {
  if (!isAuditSignatureValue(raw)) return <span>Đã ký</span>;
  const src = String(raw).startsWith('data:image/') ? String(raw) : `data:image/png;base64,${raw}`;
  return (
    <div className="audit-detail__signature">
      <img src={src} alt="Chữ ký khách hàng" />
      <span>Đã ký</span>
    </div>
  );
}

function AuditFieldCell({ row, className = 'diff-new' }) {
  const kind = row.kind || 'text';
  if (kind === 'items' || kind === 'signature') {
    return <td className={className}>{row.value}</td>;
  }
  return <td className={`${className}${kind === 'money' ? ' diff-money' : ''}`}>{row.value}</td>;
}

function auditRawEqual(a, b, kind) {
  if (kind === 'items') {
    return formatSettlementItems(a) === formatSettlementItems(b);
  }
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' && typeof b !== 'object') {
    return String(a) === String(b);
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function emptyAuditPlaceholder(key) {
  const k = String(key || '');
  if (/paymentMethod|payment_method|httt/i.test(k)) return 'Chưa chọn';
  if (/signature|signer/i.test(k)) return 'Chưa ký';
  return 'Chưa có';
}

function isBlankAuditRow(row) {
  if (!row) return true;
  if (row.raw === false || row.raw === 0) return false;
  if (row.raw == null || row.raw === '') return true;
  const v = row.value;
  return v == null || v === '' || v === '—';
}

function AuditDiffValue({ row, fieldKey }) {
  if (row?.kind === 'signature') return <AuditSignatureBlock raw={row.raw} />;
  if (row?.kind === 'items') return <SettlementItemsTable items={row.raw} />;
  if (isBlankAuditRow(row)) {
    return (
      <span className="audit-detail__placeholder">
        {emptyAuditPlaceholder(fieldKey || row?.key)}
      </span>
    );
  }
  return row.value;
}

function mergeAuditDiffRows(oldRows, newRows) {
  const map = new Map();
  (oldRows || []).forEach((r) => {
    if (!r?.key) return;
    map.set(r.key, { key: r.key, label: r.label, kind: r.kind, oldRow: r, newRow: null });
  });
  (newRows || []).forEach((r) => {
    if (!r?.key) return;
    const prev = map.get(r.key) || {
      key: r.key,
      label: r.label,
      kind: r.kind,
      oldRow: null,
      newRow: null,
    };
    prev.newRow = r;
    prev.label = r.label || prev.label;
    prev.kind = r.kind || prev.kind;
    map.set(r.key, prev);
  });
  return [...map.values()]
    .map((row) => ({
      ...row,
      changed: !auditRawEqual(row.oldRow?.raw, row.newRow?.raw, row.kind),
    }))
    .sort((a, b) => Number(b.changed) - Number(a.changed));
}

function AuditItemsDiffBlock({ row, showAll }) {
  if (!row) return null;
  if (!row.changed && !showAll) return null;
  if (!row.changed) {
    return (
      <div className="audit-detail__block">
        <div className="audit-detail__block-title">{row.label} (không đổi)</div>
        <SettlementItemsTable items={row.newRow?.raw || row.oldRow?.raw} />
      </div>
    );
  }
  return (
    <div className="audit-detail__block audit-detail__block--changed">
      <div className="audit-detail__block-title">{row.label}</div>
      <SettlementItemsSplit oldItems={row.oldRow?.raw} newItems={row.newRow?.raw} />
    </div>
  );
}

function AuditSideBySideDiff({ oldRows, newRows, summary }) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => mergeAuditDiffRows(oldRows, newRows), [oldRows, newRows]);
  if (!rows.length) return null;
  const simpleRows = rows.filter((r) => r.kind !== 'items' && r.kind !== 'signature');
  const itemsRow = rows.find((r) => r.kind === 'items');
  const sigRow = rows.find((r) => r.kind === 'signature');
  const changedCount = rows.filter((r) => r.changed).length;
  const hiddenCount = simpleRows.filter((r) => !r.changed).length
    + (itemsRow && !itemsRow.changed ? 1 : 0)
    + (sigRow && !sigRow.changed ? 1 : 0);
  const visibleSimple = showAll ? simpleRows : simpleRows.filter((r) => r.changed);

  return (
    <div className="audit-detail__diff-table">
      {summary ? <p className="audit-detail__diff-summary">{summary}</p> : null}
      <div className="audit-detail__diff-toolbar">
        <p className="audit-detail__diff-hint">
          {changedCount > 0
            ? `Tô màu ${changedCount} phần đã thay đổi — trái giá trị cũ, phải giá trị mới.`
            : 'Không có trường nào thay đổi so với giá trị cũ.'}
        </p>
        {hiddenCount > 0 && (
          <button
            type="button"
            className="audit-detail__toggle"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? 'Ẩn bớt' : 'Hiện đầy đủ'}
          </button>
        )}
      </div>
      {visibleSimple.length > 0 && (
        <div className="audit-detail__split">
          <div className="audit-detail__split-head">
            <div>Thông tin</div>
            <div>Giá trị cũ</div>
            <div>Giá trị mới</div>
          </div>
          {visibleSimple.map((row) => (
            <div
              key={row.key}
              className={`audit-detail__split-row${row.changed ? ' is-changed' : ''}`}
            >
              <div className="diff-label">{row.label}</div>
              <div className={row.changed ? 'diff-old' : 'diff-same'}>
                <AuditDiffValue row={row.oldRow} fieldKey={row.key} />
              </div>
              <div className={row.changed ? 'diff-new' : 'diff-same'}>
                <AuditDiffValue row={row.newRow} fieldKey={row.key} />
              </div>
            </div>
          ))}
        </div>
      )}
      <AuditItemsDiffBlock row={itemsRow} showAll={showAll} />
      {sigRow && !sigRow.changed && showAll && (
        <div className="audit-detail__block">
          <div className="audit-detail__block-title">{sigRow.label} (không đổi)</div>
          <AuditDiffValue row={sigRow.newRow || sigRow.oldRow} />
        </div>
      )}
      {sigRow?.changed && (
        <div className="audit-detail__block audit-detail__block--changed">
          <div className="audit-detail__block-title">{sigRow.label}</div>
          <div className="audit-detail__split">
            <div className="audit-detail__split-head">
              <div>Thông tin</div>
              <div>Giá trị cũ</div>
              <div>Giá trị mới</div>
            </div>
            <div className="audit-detail__split-row is-changed">
              <div className="diff-label">{sigRow.label}</div>
              <div className="diff-old">
                <AuditDiffValue row={sigRow.oldRow} fieldKey={sigRow.key} />
              </div>
              <div className="diff-new">
                <AuditDiffValue row={sigRow.newRow} fieldKey={sigRow.key} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Bảng key-value + khối hạng mục / chữ ký full chiều ngang */
function AuditRowsView({ rows, summary }) {
  if (!rows?.length) return null;
  const simpleRows = rows.filter((r) => r.kind !== 'items' && r.kind !== 'signature');
  const itemsRow = rows.find((r) => r.kind === 'items');
  const sigRow = rows.find((r) => r.kind === 'signature');

  return (
    <div className="audit-detail__diff-table">
      {summary ? <p className="audit-detail__diff-summary">{summary}</p> : null}

      {simpleRows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Thông tin</th>
              <th>Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {simpleRows.map((row) => (
              <tr key={row.key || row.label}>
                <td className="diff-label">{row.label}</td>
                <AuditFieldCell row={row} />
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {itemsRow && (
        <div className="audit-detail__block">
          <div className="audit-detail__block-title">{itemsRow.label}</div>
          <SettlementItemsTable items={itemsRow.raw} />
        </div>
      )}

      {sigRow && (
        <div className="audit-detail__block">
          <div className="audit-detail__block-title">{sigRow.label}</div>
          <AuditSignatureBlock raw={sigRow.raw} />
        </div>
      )}
    </div>
  );
}

/** Bảng dữ liệu tiếng Việt; nếu không phẳng được thì hiện JSON gốc */
function HumanizedDataView({ data }) {
  const rows = summarizeAuditObjectRows(data);
  if (!rows?.length) return <JsonView data={data} />;
  return <AuditRowsView rows={rows} />;
}

/**
 * Format old/new value thành dạng human-readable
 */
function DiffView({ oldValue, newValue, action, requestBody }) {
  const oldObj = parseAuditJson(oldValue);
  const newObj = parseAuditJson(newValue);
  const newEnriched = enrichAuditDisplaySource(newValue, requestBody);
  const summary = summarizeAuditNewValue(newEnriched, action);

  if (!oldObj && !newObj) return <span className="audit-detail__json-empty">—</span>;

  const oldRows = summarizeAuditObjectRows(oldValue) || [];
  const newRows = summarizeAuditObjectRows(newEnriched) || [];

  if (oldObj && newObj && (oldRows.length > 0 || newRows.length > 0)) {
    return (
      <AuditSideBySideDiff oldRows={oldRows} newRows={newRows} summary={summary?.summary} />
    );
  }

  if (summary?.rows?.length) {
    return <AuditRowsView rows={summary.rows} summary={summary.summary} />;
  }

  return (
    <div className="audit-detail__diff-raw">
      {oldObj && (
        <div className="audit-detail__diff-col">
          <label>Giá trị cũ</label>
          <HumanizedDataView data={oldValue} />
        </div>
      )}
      {newObj && (
        <div className="audit-detail__diff-col">
          <label>Giá trị mới</label>
          <HumanizedDataView data={newValue} />
        </div>
      )}
    </div>
  );
}

function isEmptyRequestBody(body) {
  if (body == null || body === '') return true;
  if (typeof body === 'string') {
    const t = body.trim();
    if (!t || t === '{}' || t === 'null' || t === '[]') return true;
    try {
      const parsed = JSON.parse(t);
      if (parsed == null) return true;
      if (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0)
        return true;
      if (Array.isArray(parsed) && parsed.length === 0) return true;
    } catch {
      return false;
    }
    return false;
  }
  if (typeof body === 'object') {
    if (Array.isArray(body)) return body.length === 0;
    return Object.keys(body).length === 0;
  }
  return false;
}

/** Nội dung chi tiết nhật ký (dùng cho trang riêng). */
export function AuditLogDetailContent({ log }) {
  if (!log) return null;
  const t = formatLocal(log.logged_at);
  const userName = log.user_name || 'Hệ thống';
  const actionLabel = getAuditActionLabel(log.action);
  const objectLabel = TABLE_NAME_VI[log.table_name] || log.entity_name || 'hệ thống';
  const entityCodeInfo = formatEntityCodeDisplay(log.entity_code, log.table_name, log.entity_name);
  const descMeta = { entityCode: log.entity_code, entityName: log.entity_name || objectLabel };
  const summary =
    humanizeAuditDescription(log.description, log.action, log.new_value, descMeta) ||
    `${userName} đã ${String(actionLabel).toLowerCase()} trên ${String(objectLabel).toLowerCase()}.`;
  const methodLabel = getHttpMethodLabel(log.request_method);
  const statusLabel = getResponseStatusLabel(log.response_status);
  const statusDetail = getResponseStatusDetail(log.response_status);
  const statusTone = getResponseStatusTone(log.response_status);
  const urlLabel = humanizeRequestUrl(log.request_url);
  const showRequestBody =
    !isEmptyRequestBody(log.request_body) && !isSameAuditPayload(log.request_body, log.new_value);
  const statusBadgeClass =
    statusTone === 'success'
      ? 'badge--success'
      : statusTone === 'danger'
        ? 'badge--danger'
        : 'badge--secondary';
  const lifecycleSteps = getLifecycleSteps(log.new_value);

  return (
    <div className="audit-detail-page__body">
      <div className="audit-detail__summary">{summary}</div>

      {lifecycleSteps.length > 0 && (
        <div className="audit-detail__lifecycle" style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            Lịch sử các bước trên phiếu này
          </label>
          <ol style={{ margin: 0, paddingLeft: 18, display: 8 }}>
            {lifecycleSteps.map((s, i) => {
              const when = s?.at ? formatLocal(s.at) : null;
              return (
                <li key={`${s?.step || 's'}-${i}`} style={{ fontSize: 13, color: '#334155' }}>
                  <strong>{s?.label || s?.step || `Bước ${i + 1}`}</strong>
                  {s?.by ? <span style={{ color: '#64748b' }}> — {s.by}</span> : null}
                  {when?.main ? <span style={{ color: '#94a3b8' }}> · {when.main}</span> : null}
                  {s?.description && s.description !== (s.label || s.step) ? (
                    <div style={{ color: '#64748b', fontSize: 12 }}>{s.description}</div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="audit-detail__row">
        <div className="audit-detail__field">
          <label>Người thực hiện</label>
          <div className="audit-detail__value">
            <span className="audit-detail__avatar">
              {(userName || '?')
                .split(' ')
                .filter(Boolean)
                .slice(-2)
                .map((p) => p[0])
                .join('')
                .toUpperCase()}
            </span>
            <strong>{userName}</strong>
            {log.phone_number && (
              <span className="audit-detail__phone">{formatPhoneDisplay(log.phone_number)}</span>
            )}
          </div>
        </div>
        <div className="audit-detail__field">
          <label>Hành động</label>
          <div className="audit-detail__value">
            <span className={`badge ${ACTION_CLASS[log.action] || 'badge--secondary'}`}>
              {actionLabel}
            </span>
          </div>
        </div>
        <div className="audit-detail__field">
          <label>Đối tượng</label>
          <div className="audit-detail__value">
            <strong>{objectLabel}</strong>
          </div>
        </div>
      </div>

      {entityCodeInfo && (
        <div className="audit-detail__row">
          <div className="audit-detail__field audit-detail__field--full">
            <label>{entityCodeInfo.label}</label>
            <div className="audit-detail__value" title={entityCodeInfo.hint}>
              <strong className="audit-detail__code">{entityCodeInfo.value}</strong>
              <span className="audit-detail__code-hint">{entityCodeInfo.hint}</span>
            </div>
          </div>
        </div>
      )}

      <div className="audit-detail__row audit-detail__row--secondary">
        <div className="audit-detail__field">
          <label>Kết quả</label>
          <span className={`badge ${statusBadgeClass}`} title={statusDetail}>
            {statusLabel}
          </span>
        </div>
        {log.request_method && (
          <div className="audit-detail__field">
            <label>Loại thao tác</label>
            <span>{methodLabel}</span>
          </div>
        )}
        {urlLabel && (
          <div className="audit-detail__field audit-detail__field--full">
            <label>Nội dung thao tác</label>
            <span>{urlLabel}</span>
          </div>
        )}
        {log.duration_ms != null && (
          <div className="audit-detail__field">
            <label>Thời gian xử lý</label>
            <span>{formatDurationMs(log.duration_ms)}</span>
          </div>
        )}
        {(log.branch_name || log.branchName) && (
          <div className="audit-detail__field">
            <label>Chi nhánh</label>
            <span>{log.branch_name || log.branchName}</span>
          </div>
        )}
        {log.ip_address && (
          <div className="audit-detail__field">
            <label>Địa chỉ IP</label>
            <span>{log.ip_address}</span>
          </div>
        )}
      </div>

      {log.description && (
        <div className="audit-detail__section">
          <label>Mô tả</label>
          <p className="audit-detail__description">
            {humanizeAuditDescription(log.description, log.action, log.new_value, descMeta)}
          </p>
        </div>
      )}

      {(log.old_value || log.new_value) && (
        <div className="audit-detail__diff">
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#475569' }}>
            Chi tiết thay đổi
          </label>
          <DiffView
            oldValue={log.old_value}
            newValue={log.new_value}
            action={log.action}
            requestBody={log.request_body}
          />
        </div>
      )}

      {showRequestBody && (
        <div className="audit-detail__section">
          <label>Dữ liệu gửi kèm</label>
          <HumanizedDataView data={log.request_body} />
        </div>
      )}

      <div className="audit-detail__timestamp">
        <span title={t.sub}>{t.main}</span>
      </div>
    </div>
  );
}
