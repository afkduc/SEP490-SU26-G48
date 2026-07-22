import { useEffect, useRef, useCallback, useState } from 'react';
import { API_BASE_URL } from '../config';

const SSE_RECONNECT_DELAY_MS = 3000;

/**
 * Hook SSE (Server-Sent Events) cho "Yeu cau" realtime - scope theo branch
 * cua CVDV dang dang nhap (server tu doc branchId tu token, xem sseRoutes.js).
 *
 * EventSource khong gui duoc header Authorization nen phai dinh token qua
 * query string - xem giai thich trong BE/src/presentation/routes/sseRoutes.js.
 *
 * @param {function} onEvent - callback(eventData) duoc goi khi co event
 * @param {boolean} enabled - bat/tat SSE
 * @returns {{ connected: boolean, error: string|null }}
 */
export function useServiceRequestsSSE(onEvent, enabled = true) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!enabled || !token) {
      setConnected(false);
      return;
    }

    const url = `${API_BASE_URL}/sse/service-requests?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      setError(null);
    });

    es.addEventListener('service-request', (e) => {
      try {
        const data = JSON.parse(e.data);
        onEventRef.current?.(data);
      } catch (err) {
        console.warn('[useServiceRequestsSSE] Failed to parse event data:', err);
      }
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      if (enabled) {
        reconnectTimerRef.current = setTimeout(connect, SSE_RECONNECT_DELAY_MS);
      }
    };
  }, [enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return { connected, error };
}
