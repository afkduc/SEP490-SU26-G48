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
  page: 1,
  pageSize: 10,
};

/**
 * Hook lấy danh sách phiên đăng nhập (login sessions) cho admin.
 * `userName` và `phone` được debounce 200ms thông qua usePaginatedList.
 */
export function useLoginSessions(seedDefaults = {}) {
  const list = usePaginatedList({
    apiFn: adminLoginSessionsApi.list,
    defaultParams: { ...DEFAULT_PARAMS, ...seedDefaults },
    debounceKeys: ['userName', 'phone', 'ipAddress'],
    debounceMs: 200,
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
