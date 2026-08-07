/**
 * Chuẩn hóa tên/mã đối tượng trong thông báo — dễ hiểu với người dùng không kỹ thuật.
 */

function formatEntityName(name, id, entityTypeVi = 'Bản ghi') {
  const n = String(name || '').trim();
  if (n && !/^ID-\d+$/i.test(n)) return n;
  if (id != null && id !== '') return `${entityTypeVi} #${id}`;
  return entityTypeVi;
}

function buildTargetDisplay(targetName, targetCode) {
  const name = String(targetName || '').trim();
  const code = String(targetCode || '').trim();
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return '';
}

/**
 * Thay placeholder trong template; bỏ phần trống / placeholder chưa thay.
 */
function interpolateMessage(template, data = {}) {
  if (!template) return '';

  const targetDisplay = buildTargetDisplay(data.targetName, data.targetCode);
  const vars = {
    actorName: data.actorName || '',
    targetName: data.targetName || '',
    targetCode: data.targetCode || '',
    targetDisplay,
    device: data.device || '',
    location: data.location || '',
    count: data.count != null ? String(data.count) : '',
    roles: data.roles || '',
    permissionKey: data.permissionKey || '',
    reason: data.reason ? ` — Lý do: ${data.reason}` : '',
  };

  let message = String(template);
  Object.entries(vars).forEach(([key, val]) => {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  });

  message = message.replace(/\{[a-zA-Z]+\}/g, '');
  message = message.replace(/\s*\(\s*\)/g, '');
  message = message.replace(/\s{2,}/g, ' ').trim();
  message = message.replace(/\s+([,.])/g, '$1');

  return message;
}

module.exports = {
  formatEntityName,
  buildTargetDisplay,
  interpolateMessage,
};
