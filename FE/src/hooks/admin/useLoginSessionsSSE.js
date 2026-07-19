import { useEffect, useRef, useCallback, useState } from 'react';
import { API_BASE_URL } from '../../config';

const SSE_RECONNECT_DELAY_MS = 3000;

/**
 * Hook SSE (Server-Sent Events) cho login sessions realtime updates.
 *
 * @param {function} onEvent - callback(eventData) duoc goi khi co event
 * @param {boolean} enabled - bat/tat SSE
 * @returns {{ connected: boolean, error: string|null }}
 */
export function useLoginSessionsSSE(onEvent, enabled = true) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const onEventRef = useRef(onEvent);

  // Cap nhat ref khi onEvent thay doi
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

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

    const url = `${API_BASE_URL}/sse/login-sessions`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      setError(null);
    });

    es.addEventListener('login-session', (e) => {
      try {
        const data = JSON.parse(e.data);
        onEventRef.current?.(data);
      } catch (err) {
        console.warn('[useLoginSessionsSSE] Failed to parse event data:', err);
      }
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Tu dong reconnect sau delay
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
