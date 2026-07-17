/**
 * Trigger browser download cho Blob (dung cho file export Excel tu BE).
 *
 * @param {Blob} blob - Blob tu response (Content-Type: application/vnd.openxmlformats-...)
 * @param {string} filename - ten file mac dinh neu response khong co Content-Disposition
 */
export function downloadBlob(blob, filename = 'download') {
  if (!blob) return;

  // Lay filename tu Content-Disposition neu co
  const cd = blob.__contentDisposition;
  let finalName = filename;
  if (cd) {
    const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
      finalName = decodeURIComponent(utf8Match[1]);
    } else {
      const plainMatch = cd.match(/filename="?([^";]+)"?/i);
      if (plainMatch) finalName = plainMatch[1];
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke sau mot nhip de trinh duyet xu ly xong
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Build query string tu object, bo qua gia tri null/undefined/empty.
 */
function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Fetch 1 endpoint va tra ve Blob (cho cac response binary nhu Excel).
 * Tu dong gan Authorization header tu localStorage/sessionStorage.
 */
export async function fetchBlob(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch (_) {
      // ignore parse error
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  const blob = await response.blob();
  const cd = response.headers.get('Content-Disposition');
  if (cd) blob.__contentDisposition = cd;
  return blob;
}

export { buildQuery };