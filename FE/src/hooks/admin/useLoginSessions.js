import { useState, useEffect, useCallback } from 'react';
import { adminLoginSessionsApi, adminBranchesApi } from '../../services/adminApi';

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

export function useLoginSessions() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [params, setParamsState] = useState(DEFAULT_PARAMS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setParams = useCallback((updater) => {
    setParamsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return { ...prev, ...next };
    });
  }, []);

  const updateParam = useCallback((key, value) => {
    setParamsState((prev) => {
      if (key === 'page') return { ...prev, [key]: value };
      return { ...prev, [key]: value, page: 1 };
    });
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = {};
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs[k] = v;
      });
      const res = await adminLoginSessionsApi.list(qs);
      const items = res?.items ?? res ?? [];
      setData({
        items: Array.isArray(items) ? items : [],
        total: res?.total ?? (Array.isArray(items) ? items.length : 0),
        page: Number(res?.page || params.page || 1),
        pageSize: Number(res?.pageSize || params.pageSize || 10),
      });
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, params, setParams, updateParam, loading, error, refetch: fetch };
}
