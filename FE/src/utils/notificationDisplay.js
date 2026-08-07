/**
 * Hiển thị thông báo bằng tiếng Việt dễ hiểu (kể cả bản ghi cũ trong DB).
 */
import { getPermissionScreenLabel } from './screenLabels';

export const SEVERITY_LABELS_VI = {
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
  success: 'Thành công',
  info: 'Thông tin',
  warning: 'Cảnh báo',
  error: 'Lỗi',
};

export function getSeverityLabelVi(severity) {
  if (!severity) return '';
  const key = String(severity).toLowerCase();
  return SEVERITY_LABELS_VI[key] || severity;
}

function parseMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

/**
 * Làm sạch & Việt hóa nội dung thông báo (placeholder, mã quyền, ID kỹ thuật).
 */
export function humanizeNotificationMessage(message, metadata = {}) {
  if (!message) return '';
  const meta = parseMetadata(metadata);
  let text = String(message);

  text = text.replace(/\{([a-zA-Z]+)\}/g, (_, key) => {
    if (meta[key] != null && meta[key] !== '') return String(meta[key]);
    return '';
  });

  text = text.replace(/\s*\(\s*\)/g, '');
  text = text.replace(/\s{2,}/g, ' ').trim();

  text = text.replace(/screen:[a-z0-9_.:-]+/gi, (m) => {
    const label = getPermissionScreenLabel(m);
    return label && label !== '—' ? `«${label}»` : m;
  });

  text = text.replace(/\bID-(\d+)\b/gi, 'bản ghi #$1');

  return text;
}
