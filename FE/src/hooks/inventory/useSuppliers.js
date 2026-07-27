import { useState, useEffect, useCallback } from 'react';
import { getSuppliersApi } from '../../services/supplierApi';

/**
 * Quan ly trang thai danh sach nha cung cap (read-only).
 */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState({ search: '', status: '' });

  const fetch = useCallback(
    async (filters = params) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSuppliersApi(filters);
        setSuppliers(res.items || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [params.search, params.status],
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  const setSearch = useCallback((search) => {
    setParams((p) => ({ ...p, search }));
  }, []);

  const setStatus = useCallback((status) => {
    setParams((p) => ({ ...p, status }));
  }, []);

  const applyFilters = useCallback(() => {
    fetch(params);
  }, [fetch, params]);

  return {
    suppliers,
    loading,
    error,
    params,
    setSearch,
    setStatus,
    applyFilters,
    refetch: () => fetch(params),
  };
}