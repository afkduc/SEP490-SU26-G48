import { useState, useEffect, useCallback } from 'react';
import {
  getProductsApi,
  createProductApi,
  updateProductApi,
  deactivateProductApi,
  reactivateProductApi,
  getCategoriesApi,
} from '../../services/productApi';

/**
 * Quan ly danh sach phu tung: tai, loc, tao, sua, ngung/kich hoat (khong hard delete).
 */
export function useParts({ branchId } = {}) {
  const [parts, setParts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [params, setParams] = useState({
    search: '',
    status: '',
    category: '',
    lowStockOnly: false,
    page: 1,
    limit: 20,
  });

  const fetchData = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getProductsApi({ ...params, branchId });
      setParts(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId, params.search, params.status, params.category, params.lowStockOnly, params.page, params.limit]);

  useEffect(() => {
    if (!branchId) return;
    fetchData();
  }, [branchId, fetchData]);

  useEffect(() => {
    getCategoriesApi()
      .then((cats) => setCategories(Array.isArray(cats) ? cats : []))
      .catch(() => setCategories([]));
  }, []);

  const create = useCallback(
    async (data) => {
      const res = await createProductApi({ ...data, branchId });
      setParts((prev) => [res, ...prev]);
      setTotal((t) => t + 1);
      return res;
    },
    [branchId],
  );

  const update = useCallback(async (id, data) => {
    const res = await updateProductApi(id, data);
    setParts((prev) => prev.map((p) => (p.id === id ? res : p)));
    return res;
  }, []);

  const deactivate = useCallback(async (id) => {
    const res = await deactivateProductApi(id);
    setParts((prev) => {
      if (params.status === 'active') {
        setTotal((t) => Math.max(0, t - 1));
        return prev.filter((p) => p.id !== id);
      }
      return prev.map((p) => (p.id === id ? res : p));
    });
    return res;
  }, [params.status]);

  const reactivate = useCallback(async (id) => {
    const res = await reactivateProductApi(id);
    setParts((prev) => {
      if (params.status === 'inactive') {
        setTotal((t) => Math.max(0, t - 1));
        return prev.filter((p) => p.id !== id);
      }
      return prev.map((p) => (p.id === id ? res : p));
    });
    return res;
  }, [params.status]);

  /** Alias: soft-disable (không hard delete) */
  const remove = deactivate;

  const setSearch = useCallback((v) => {
    setParams((p) => ({ ...p, search: v, page: 1 }));
  }, []);

  const setStatus = useCallback((v) => {
    setParams((p) => ({ ...p, status: v, page: 1 }));
  }, []);

  const setCategory = useCallback((v) => {
    setParams((p) => ({ ...p, category: v, page: 1 }));
  }, []);

  const setLowStockOnly = useCallback((v) => {
    setParams((p) => ({ ...p, lowStockOnly: v, page: 1 }));
  }, []);

  const setPage = useCallback((v) => {
    setParams((p) => ({ ...p, page: v }));
  }, []);

  return {
    parts,
    total,
    loading,
    error,
    categories,
    params,
    setParams,
    setSearch,
    setStatus,
    setCategory,
    setLowStockOnly,
    setPage,
    fetch: fetchData,
    create,
    update,
    deactivate,
    reactivate,
    remove,
  };
}
