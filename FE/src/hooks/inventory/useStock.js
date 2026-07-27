import { useState, useEffect, useCallback } from 'react';
import {
  getStockListApi,
  getLowStockApi,
  getStockSummaryApi,
  getCategoriesApi,
} from '../../services/inventoryApi';

/**
 * Quan ly trang thai trang Ton kho:
 * - Danh sach ton kho theo chi nhanh + filter
 * - Canh bao ton kho thap
 * - Tong hop theo category
 *
 * Tat ca cac query dong thoi khi mount / khi params thay doi (Promise.all).
 */
export function useStock(initialBranchId) {
  const [params, setParams] = useState({
    branchId: initialBranchId,
    search: '',
    category: '',
    lowStockOnly: false,
    page: 1,
    limit: 20,
  });

  const [stockList, setStockList] = useState({ items: [], total: 0, page: 1, limit: 20 });
  const [lowStock, setLowStock] = useState([]);
  const [summary, setSummary] = useState({
    summary: [],
    totalProducts: 0,
    totalQuantity: 0,
    totalValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);

  const { branchId, search, category, lowStockOnly, page, limit } = params;

  const fetchAll = useCallback(async () => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [listRes, lowRes, summaryRes] = await Promise.all([
        getStockListApi({ branchId, search, category, lowStockOnly, page, limit }),
        getLowStockApi(branchId),
        getStockSummaryApi(branchId),
      ]);
      setStockList(listRes || { items: [], total: 0, page, limit });
      setLowStock((lowRes && lowRes.items) || []);
      setSummary(
        summaryRes || { summary: [], totalProducts: 0, totalQuantity: 0, totalValue: 0 },
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchId, search, category, lowStockOnly, page, limit]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    getCategoriesApi()
      .then((cats) => setCategories(Array.isArray(cats) ? cats : []))
      .catch(() => setCategories([]));
  }, []);

  const setSearch = useCallback((v) => {
    setParams((p) => ({ ...p, search: v, page: 1 }));
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
    stockList,
    lowStock,
    summary,
    loading,
    error,
    categories,
    params,
    setSearch,
    setCategory,
    setLowStockOnly,
    setPage,
    refetch: fetchAll,
  };
}