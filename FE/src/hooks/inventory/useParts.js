import { useState, useEffect, useCallback } from 'react';
import {
  getPartsApi,
  createPartApi,
  updatePartApi,
  deletePartApi,
} from '../../services/partMockApi';

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
  }, [params]);

  useEffect(() => {
    fetch();
  }, []);

  const create = useCallback(async (data) => {
    const res = await createPartApi(data);
    setParts((prev) => [...prev, res.data]);
    return res;
  }, []);

  const update = useCallback(async (id, data) => {
    const res = await updatePartApi(id, data);
    setParts((prev) => prev.map((p) => (p.id === id ? res.data : p)));
    return res;
  }, []);

  const remove = useCallback(async (id) => {
    await deletePartApi(id);
    setParts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { parts, loading, error, params, setParams, fetch, create, update, remove };
}
