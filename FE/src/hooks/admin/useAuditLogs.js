import { usePaginatedList } from './usePaginatedList';
import { auditApi } from '../../services/auditApi';

const DEFAULT_PAGE_SIZE = 10;

const DEFAULT_PARAMS = {
  keyword: '',
  userName: '',
  phone: '',
  action: '',
  tableName: '',
  entityName: '',
  entityCode: '',
  ipAddress: '',
  requestMethod: '',
  responseStatus: '',
  startDate: '',
  endDate: '',
  branchId: undefined,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

/**
 * Hook lấy danh sách audit logs (UC-00 System Log).
 * `userName`, `phone`, `keyword`, `entityCode` được debounce 200ms thông qua usePaginatedList.
 */
export function useAuditLogs(initialParams = {}) {
  const list = usePaginatedList({
    apiFn: auditApi.getAuditLogs,
    defaultParams: { ...DEFAULT_PARAMS, ...initialParams },
    debounceKeys: ['keyword', 'userName', 'phone', 'entityCode'],
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
  };
}
