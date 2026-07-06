import { useState, useEffect, useCallback } from 'react';
import { getSuppliersApi, createSupplierApi, updateSupplierApi, deleteSupplierApi } from '../../services/inventoryMockApi';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState({ search: '', status: '' });

  const fetch = useCallback(async (filters = params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSuppliersApi(filters);
      setSuppliers(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload) => {
    const res = await createSupplierApi(payload);
    setSuppliers((prev) => [...prev, res.data]);
    return res.data;
  }, []);

  const update = useCallback(async (id, payload) => {
    const res = await updateSupplierApi(id, payload);
    setSuppliers((prev) => prev.map((s) => (s.id === Number(id) ? res.data : s)));
    return res.data;
  }, []);

  const remove = useCallback(async (id) => {
    await deleteSupplierApi(id);
    setSuppliers((prev) => prev.filter((s) => s.id !== Number(id)));
  }, []);

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
    suppliers, loading, error,
    params, setSearch, setStatus, applyFilters,
    create, update, remove, refetch: () => fetch(params),
  };
}
