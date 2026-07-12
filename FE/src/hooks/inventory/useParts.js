import { useState, useEffect, useCallback } from 'react';
import {
  getProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,
} from '../../services/productApi';

/**
 * Quan ly trang thai danh sach phu tung: tai, loc, tao, sua, xoa.
 * BranchId duoc truyen tu ben ngoai (vi moi user chi thao tac trong chi nhanh cua minh).
 */
export function useParts({ branchId } = {}) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState({
    search: '',
    status: '',
    category: '',
    lowStockOnly: false,
  });

  const fetch = useCallback(
    async (filters = params) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getProductsApi({ ...filters, branchId });
        // BE tra ve { items, total, page, limit }
        setParts(res.items || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [branchId, params.search, params.status, params.category, params.lowStockOnly],
  );

  useEffect(() => {
    if (!branchId) return;
    fetch();
  }, [fetch, branchId]);

  const create = useCallback(
    async (data) => {
      const res = await createProductApi({ ...data, branchId });
      setParts((prev) => [...prev, res]);
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
  }, []);

  return {
    parts,
    loading,
    error,
    params,
    setParams,
    fetch,
    create,
    update,
    remove,
  };
}