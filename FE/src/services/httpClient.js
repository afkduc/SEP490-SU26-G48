import { API_BASE_URL } from '../config';

export const SESSION_EXPIRED_KEY = 'SESSION_EXPIRED';

export function showSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_KEY));
}

class HttpClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(path, {
    method = 'GET',
    body,
    headers = {},
    isForm = false,
    omitAuth = false,
    skipSessionExpired = false,
  } = {}) {
    const token = omitAuth
      ? null
      : localStorage.getItem('token') || sessionStorage.getItem('token');
    const response = await fetch(`${this.baseURL}${path}`, {
      method,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const currentToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const belongsToCurrentSession = Boolean(token && token === currentToken);
      if (response.status === 401 && belongsToCurrentSession && !skipSessionExpired) {
        showSessionExpired();
      }
      const message = (payload && payload.message) || response.statusText;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    // BE wraps all responses in { success, message, data }
    // Unwrap to return just the data so callers don't need .data everywhere
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data;
    }
    return payload;
  }

  get(path, options = {}) {
    return this.request(path, { method: 'GET', ...options });
  }

  post(path, body, options = {}) {
    return this.request(path, { method: 'POST', body, ...options });
  }

  postForm(path, formData, options = {}) {
    return this.request(path, { method: 'POST', body: formData, isForm: true, ...options });
  }

  put(path, body, options = {}) {
    return this.request(path, { method: 'PUT', body, ...options });
  }

  patch(path, body, options = {}) {
    return this.request(path, { method: 'PATCH', body, ...options });
  }

  delete(path, options = {}) {
    return this.request(path, { method: 'DELETE', ...options });
  }
}

const httpClient = new HttpClient();

export default httpClient;
export { HttpClient };
