import { API_BASE_URL } from '../config';

export const SESSION_EXPIRED_KEY = 'SESSION_EXPIRED';

export function showSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_KEY));
}

class HttpClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(path, { method = 'GET', body, headers = {}, isForm = false } = {}) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
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
      if (response.status === 401) {
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

  get(path) {
    return this.request(path, { method: 'GET' });
  }

  post(path, body) {
    return this.request(path, { method: 'POST', body });
  }

  postForm(path, formData) {
    return this.request(path, { method: 'POST', body: formData, isForm: true });
  }

  put(path, body) {
    return this.request(path, { method: 'PUT', body });
  }

  patch(path, body) {
    return this.request(path, { method: 'PATCH', body });
  }

  delete(path) {
    return this.request(path, { method: 'DELETE' });
  }
}

const httpClient = new HttpClient();

export default httpClient;
export { HttpClient };
