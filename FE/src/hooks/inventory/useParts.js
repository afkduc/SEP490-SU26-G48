import { useState, useEffect, useCallback } from 'react';
import {
  getProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,
  getCategoriesApi,
} from '../../services/productApi';

/**
 * Quan ly trang thai danh sach phu tung: tai, loc, tao, sua, xoa.
 * BranchId duoc truyen tu ben ngoai (vi moi user chi thao tac trong chi nhanh cua minh).
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

  const remove = useCallback(async (id) => {
    await deleteProductApi(id);
    setParts((prev) => prev.filter((p) => p.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

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
    remove,
  };
}
