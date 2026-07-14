import { useCallback, useEffect, useRef, useState } from 'react';
import { adminUsersApi } from '../../services/adminApi';

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Hook lay danh sach users cho admin page (UC-07).
 *
 * Params (object):
 *   - search    : chuoi tim kiem (se duoc debounce 400ms)
 *   - branchId  : ID chi nhanh (so)
 *   - roleId    : ten role (chuoi)
 *   - status    : active | inactive | locked
 *   - page      : so trang (mac dinh 1)
 *   - pageSize  : so ban ghi moi trang (mac dinh 10)
 *
 * Tra ve:
 *   - data       : { items, total, page, pageSize } tu API
 *   - loading    : boolean
 *   - error      : Error | null
 *   - refetch()  : goi lai API voi params hien tai
 *   - params     : object params hien tai (de binding UI)
 *   - setParams  : cap nhat params (search se duoc debounce)
 */
export function useAdminUsers(initialParams = {}) {
  const [params, setParams] = useState({
    search: '',
    branchId: undefined,
    roleId: undefined,
    status: undefined,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    ...initialParams,
  });

  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce search: chi call API khi user ngung go 400ms
  const [debouncedSearch, setDebouncedSearch] = useState(params.search);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(params.search);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [params.search]);

  /**
   * Goi API voi params hien tai (search da duoc debounce).
   * Recreate khi cac filter thay doi -> useEffect tu dong chay lai.
   */
  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUsersApi.list({
        search: debouncedSearch || undefined,
        branchId: params.branchId,
        roleId: params.roleId,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
      });
      setData(res || { items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
    } catch (err) {
      setError(err);
      setData({ items: [], total: 0, page: params.page, pageSize: params.pageSize });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, params.branchId, params.roleId, params.status, params.page, params.pageSize]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  /**
   * Helper: cap nhat mot filter va reset ve page 1.
   * VD: updateParam('branchId', 2) -> tu dong reset page ve 1.
   */
  const updateParam = useCallback((key, value) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  }, []);

  /**
   * Helper: refetch NGAY LAP TUC khong doi debounce.
   * Dung sau mutation (create/update/toggle status/doi role).
   * Force-flush debouncedSearch ve gia tri search hien tai truoc khi fetch
   * de dam bao goi dung search dang dung.
   */
  const refresh = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setDebouncedSearch(params.search ?? '');
    setLoading(true);
    setError(null);
    try {
      const res = await adminUsersApi.list({
        search: params.search || undefined,
        branchId: params.branchId,
        roleId: params.roleId,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
      });
      setData(res || { items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
    } catch (err) {
      setError(err);
      setData({ items: [], total: 0, page: params.page, pageSize: params.pageSize });
    } finally {
      setLoading(false);
    }
  }, [params.search, params.branchId, params.roleId, params.status, params.page, params.pageSize]);

  return {
    data,
    loading,
    error,
    refetch: fetch,
    refresh,
    params,
    setParams,
    updateParam,
  };
}