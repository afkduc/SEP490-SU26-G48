import { useCallback } from 'react';
import { adminUsersApi } from '../../services/adminApi';
import { usePaginatedList } from './usePaginatedList';

const DEFAULT_PAGE_SIZE = 10;

const DEFAULT_PARAMS = {
  search: '',
  branchId: undefined,
  roleId: undefined,
  status: undefined,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

/**
 * Hook lấy danh sách users cho admin page (UC-07).
 * `search` được debounce 200ms thông qua usePaginatedList.
 */
export function useAdminUsers(initialParams = {}) {
  const list = usePaginatedList({
    apiFn: adminUsersApi.list,
    defaultParams: { ...DEFAULT_PARAMS, ...initialParams },
    debounceKeys: ['search'],
    debounceMs: 200,
  });

  // Wrapper để tương thích với code cũ (initialParams)
  // (Đã áp dụng initialParams qua defaultParams ở trên)
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
