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
  page: 1,
  pageSize: 10,
};

/**
 * Hook lấy danh sách phiên đăng nhập (login sessions) cho admin.
 */
export function useLoginSessions() {
  const list = usePaginatedList({
    apiFn: adminLoginSessionsApi.list,
    defaultParams: DEFAULT_PARAMS,
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
  };
}
