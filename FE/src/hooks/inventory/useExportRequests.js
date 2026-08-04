import { useState, useEffect, useCallback } from 'react';
import { getExportRequestsApi } from '../../services/exportRequestApi';

/**
 * Quan ly trang thai trang Danh sach phieu xuat kho:
 * - Filter theo status / serviceOrderId / date range / search.
 * - Phan trang page/limit.
 */
export function useExportRequests(initialBranchId) {
  const [params, setParams] = useState({
    branchId: initialBranchId,
    status: '',
    serviceOrderId: '',
    fromDate: '',
    toDate: '',
    search: '',
    page: 1,
    limit: 20,
  });

  const [result, setResult] = useState({ items: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { branchId, status, serviceOrderId, fromDate, toDate, search, page, limit } = params;

  useEffect(() => {
    setParams((current) => (
      current.branchId === initialBranchId
        ? current
        : { ...current, branchId: initialBranchId, page: 1 }
    ));
  }, [initialBranchId]);

  const fetchAll = useCallback(async () => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getExportRequestsApi({
        branchId, status, serviceOrderId, fromDate, toDate, search, page, limit,
      });
      setResult(res || { items: [], total: 0, page, limit });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId, status, serviceOrderId, fromDate, toDate, search, page, limit]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const setStatus = useCallback((v) => {
    setParams((p) => ({ ...p, status: v, page: 1 }));
  }, []);
  const setFromDate = useCallback((v) => {
    setParams((p) => ({ ...p, fromDate: v, page: 1 }));
  }, []);
  const setToDate = useCallback((v) => {
    setParams((p) => ({ ...p, toDate: v, page: 1 }));
  }, []);
  const setSearch = useCallback((v) => {
    setParams((p) => ({ ...p, search: v, page: 1 }));
  }, []);
  const setPage = useCallback((v) => {
    setParams((p) => ({ ...p, page: v }));
  }, []);

  return {
    requests: result.items || [],
    total: result.total || 0,
    page: result.page || 1,
    limit: result.limit || 20,
    loading,
    error,
    params,
    setStatus,
    setFromDate,
    setToDate,
    setSearch,
    setPage,
    refetch: fetchAll,
  };
}