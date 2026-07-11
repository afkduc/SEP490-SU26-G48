import { useState, useEffect, useCallback } from 'react';
import {
  getPartsApi,
  createPartApi,
  updatePartApi,
  deletePartApi,
} from '../../services/partMockApi';

/**
 * Quan ly trang thai danh sach parts: tai, loc, tao, sua, xoa.
 */
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

  /**
   * Tai danh sach parts tu API voi bo loc hien tai.
   * Ham duoc tao lai moi khi params thay doi -> useEffect ben duoi se chay lai.
   */
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
  }, [params.search, params.status, params.category, params.lowStockOnly]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  /**
   * Tao moi mot part, them vao state.
   * @param {Object} data
   * @returns {Promise<{ data: Part }>}
   */
  const create = useCallback(async (data) => {
    const res = await createPartApi(data);
    setParts((prev) => [...prev, res.data]);
    return res;
  }, []);

  /**
   * Cap nhat mot part trong state.
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<{ data: Part }>}
   */
  const update = useCallback(async (id, data) => {
    const res = await updatePartApi(id, data);
    setParts((prev) => prev.map((p) => (p.id === id ? res.data : p)));
    return res;
  }, []);

  /**
   * Xoa mot part khoi state.
   * @param {number} id
   */
  const remove = useCallback(async (id) => {
    await deletePartApi(id);
    setParts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { parts, loading, error, params, setParams, fetch, create, update, remove };
}
