import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from './AppContext';
import { ROLES } from '../constants/roles';
import { useServiceRequestsSSE } from '../hooks/useServiceRequestsSSE';
import { useToast } from '../components/common/ToastContext';
import { getServiceRequests, getServiceRequestUnreadCount } from '../services/serviceRequestApi';

const ServiceRequestsContext = createContext(null);

// Chi CVDV moi can theo doi "Yeu cau" tu landing page - cac role khac
// khong mount context nay (tranh mo ket noi SSE khong can thiet).
export function ServiceRequestsProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const enabled = user?.primaryRole === ROLES.SERVICE_ADVISOR;

  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    try {
      const [list, unread] = await Promise.all([
        getServiceRequests(),
        getServiceRequestUnreadCount(),
      ]);
      // httpClient tu unwrap "payload.data" - list/unread da la du lieu thuc,
      // khong phai { data: ... } nua.
      setRequests(list || []);
      setPendingCount(unread?.count || 0);
    } catch (err) {
      console.warn('[ServiceRequestsContext] refetch failed:', err.message);
    }
  }, [enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleSSEEvent = useCallback(
    (event) => {
      if (event.type === 'new-request') {
        setRequests((prev) => [event.request, ...prev]);
        setPendingCount((c) => c + 1);
        toast.info('Có khách hàng vừa gửi yêu cầu tư vấn mới!');
      } else if (event.type === 'request-updated') {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === event.id
              ? { ...r, status: event.status, acceptedBy: event.acceptedBy, acceptedByName: event.acceptedByName, acceptedAt: event.acceptedAt }
              : r
          )
        );
        setPendingCount((c) => Math.max(0, c - 1));
      }
    },
    [toast]
  );

  useServiceRequestsSSE(handleSSEEvent, enabled);

  const value = useMemo(
    () => ({ requests, pendingCount, refetch }),
    [requests, pendingCount, refetch]
  );

  return <ServiceRequestsContext.Provider value={value}>{children}</ServiceRequestsContext.Provider>;
}

export function useServiceRequests() {
  const ctx = useContext(ServiceRequestsContext);
  if (!ctx) {
    // Component ngoai provider (vd role khac SERVICE_ADVISOR) - tra ve gia
    // tri rong thay vi throw, de Navbar dung chung cho moi role deu an toan.
    return { requests: [], pendingCount: 0, refetch: () => {} };
  }
  return ctx;
}
