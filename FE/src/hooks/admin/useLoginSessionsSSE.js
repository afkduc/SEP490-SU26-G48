import { useEffect, useRef, useCallback, useState } from 'react';
import { API_BASE_URL } from '../../config';

const SSE_RECONNECT_DELAY_MS = 3000;

/**
 * Hook SSE (Server-Sent Events) cho login sessions realtime updates.
 *
 * Browser EventSource API KHONG ho tro custom headers nen truyen JWT qua
 * query string `?token=<jwt>`. Backend (BE/presentation/routes/sseRoutes.js)
 * validate Bearer header hoac `?token=` query -> tra 401 neu fail.
 *
 * @param {function} onEvent - callback(eventData) duoc goi khi co event
 * @param {boolean} enabled - bat/tat SSE
 * @param {string} [token] - JWT de auth SSE (lay tu localStorage/sessionStorage)
 * @returns {{ connected: boolean, error: string|null }}
 */
export function useLoginSessionsSSE(onEvent, enabled = true, token = null) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const tokenRef = useRef(token);

  // Cap nhat ref khi onEvent hoac token thay doi (khong reconnect)
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const connect = useCallback(() => {
    // Don dep cu~
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (!enabled) {
      setConnected(false);
      return;
    }

    // Append token vao query (tranh undefined/null)
    const qs = tokenRef.current
      ? `?token=${encodeURIComponent(tokenRef.current)}`
      : '';
    const url = `${API_BASE_URL}/sse/login-sessions${qs}`;

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        setConnected(true);
        setError(null);
      });

      // Server tra 401/403 qua SSE -> error event chua JSON error payload
      es.addEventListener('error', (e) => {
        // EventSource khong expose status code truc tiep,
        // nhung neu server da dong connection (401) -> es.readyState = CLOSED (2)
        if (es.readyState === EventSource.CLOSED) {
          setConnected(false);
          setError('SSE connection closed (auth?)');
          // Khong reconnect neu auth fail (se retry 401 vo han)
          // User can F5 sau khi login de retry.
        }
      });

      es.addEventListener('login-session', (e) => {
        try {
          const data = JSON.parse(e.data);
          onEventRef.current?.(data);
        } catch (err) {
          console.warn('[useLoginSessionsSSE] Failed to parse event data:', err);
        }
      });

      // Native onerror fallback (cho browser cu)
      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;
        // Chi reconnect neu con enabled va khong bi auth fail
        if (enabled) {
          reconnectTimerRef.current = setTimeout(connect, SSE_RECONNECT_DELAY_MS);
        }
      };
    } catch (err) {
      // Construct EventSource co the throw neu URL khong hop le
      console.warn('[useLoginSessionsSSE] EventSource failed:', err);
      setError(err && err.message);
      if (enabled) {
        reconnectTimerRef.current = setTimeout(connect, SSE_RECONNECT_DELAY_MS);
      }
    }
  }, [enabled]); // chi reconnect khi enabled thay doi

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return { connected, error };
}
