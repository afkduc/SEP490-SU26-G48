import { usePaginatedList } from './usePaginatedList';
import { adminLoginSessionsApi } from '../../services/adminApi';

const DEFAULT_PARAMS = {
  userName: '',
  phone: '',
  actionType: '',
  status: '',
  startDate: '',
  endDate: '',
  branchId: undefined,
  ipAddress: '',
  sessionId: undefined,
  page: 1,
  pageSize: 10,
};

/**
 * Hook lấy danh sách phiên đăng nhập (login sessions) cho admin.
 * `userName`, `phone`, `ipAddress` được debounce 350ms thông qua usePaginatedList.
 * Các field lọc kết hợp theo AND trên backend.
 */
/** Keys debounce ổn định theo identity (tránh recreate updateParam mỗi render). */
const LOGIN_SESSION_DEBOUNCE_KEYS = ['userName', 'phone', 'ipAddress'];

export function useLoginSessions(seedDefaults = {}) {
  const list = usePaginatedList({
    apiFn: adminLoginSessionsApi.list,
    defaultParams: { ...DEFAULT_PARAMS, ...seedDefaults },
    debounceKeys: LOGIN_SESSION_DEBOUNCE_KEYS,
    debounceMs: 350,
  });

  return {
    data: list.data,
    loading: list.loading,
    error: list.error,
    params: list.params,
    setParams: list.setParams,
    updateParam: list.updateParam,
    refetch: list.refetch,
    refresh: list.refresh,
    setItems: list.setItems,
  };
}
