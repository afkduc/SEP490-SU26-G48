import { useState, useEffect, useCallback } from 'react';
import { getManagerExportRequestsApi } from '../../services/managerExportRequestApi';

/**
 * Quan ly trang thai trang Manager > Phieu xuat kho:
 * - Filter theo status / date range / search.
 * - Phan trang page/limit.
 * Manager chi xem lich su - NVKho tu xuat truc tiep.
 */
export function useManagerExportRequests(initialBranchId) {
  const [params, setParams] = useState({
    branchId: initialBranchId,
    status: '',
    fromDate: '',
    toDate: '',
    search: '',
    page: 1,
    limit: 20,
  });

  const [result, setResult] = useState({ items: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { branchId, status, fromDate, toDate, search, page, limit } = params;

  const fetchAll = useCallback(async () => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getManagerExportRequestsApi({
        branchId, status, fromDate, toDate, search, page, limit,
      });
      setResult(res || { items: [], total: 0, page, limit });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId, status, fromDate, toDate, search, page, limit]);

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