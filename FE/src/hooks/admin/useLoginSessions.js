import { useState, useEffect, useCallback } from 'react';
import { adminLoginSessionsApi } from '../../services/adminApi';
import { usePaginatedList } from './usePaginatedList';

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
 * Trả về cùng shape với usePaginatedList + helper setParams hỗ trợ function updater.
 */
export function useLoginSessions() {
  const list = usePaginatedList({
    apiFn: adminLoginSessionsApi.list,
    defaultParams: DEFAULT_PARAMS,
  });

  const setParams = useCallback((updater) => {
    list.setParams((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return { ...prev, ...next };
    });
  }, [list]);

  return {
    data: list.data,
    loading: list.loading,
    error: list.error,
    params: list.params,
    setParams,
    updateParam: list.updateParam,
    refetch: list.refetch,
    refresh: list.refresh,
  };
}