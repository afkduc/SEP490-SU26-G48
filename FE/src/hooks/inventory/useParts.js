import { useState, useEffect, useCallback } from 'react';
import {
  getPartsApi,
  createPartApi,
  updatePartApi,
  deletePartApi,
} from '../services/partMockApi';

export function useParts() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState({
    search: '',
    status: '',
    category: '',
    lowStockOnly: false,
  });

  const fetch = useCallback(async (filters = params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPartsApi(filters);
      setParts(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, []);

  const create = useCallback(async (payload) => {
    const res = await createPartApi(payload);
    setParts((prev) => [...prev, res.data]);
    return res.data;
  }, []);

  const update = useCallback(async (id, payload) => {
    const res = await updatePartApi(id, payload);
    setParts((prev) =>
      prev.map((p) => (p.id === Number(id) ? res.data : p)),
    );
    return res.data;
  }, []);

  const remove = useCallback(async (id) => {
    await deletePartApi(id);
    setParts((prev) => prev.filter((p) => p.id !== Number(id)));
  }, []);

  const setSearch = useCallback((search) => {
    setParams((p) => ({ ...p, search }));
  }, []);

  const setStatus = useCallback((status) => {
    setParams((p) => ({ ...p, status }));
  }, []);

  const setCategory = useCallback((category) => {
    setParams((p) => ({ ...p, category }));
  }, []);

  const setLowStockOnly = useCallback((lowStockOnly) => {
    setParams((p) => ({ ...p, lowStockOnly }));
  }, []);

  const applyFilters = useCallback(() => {
    fetch(params);
  }, [fetch, params]);

  return {
    parts,
    loading,
    error,
    params,
    setSearch,
    setStatus,
    setCategory,
    setLowStockOnly,
    applyFilters,
    create,
    update,
    remove,
    refetch: () => fetch(params),
  };
}
