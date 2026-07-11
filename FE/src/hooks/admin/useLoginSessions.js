import { useCallback, useEffect, useRef, useState } from 'react';
import { auditApi } from '../../services/auditApi';

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Hook lay danh sach login sessions (lich su dang nhap).
 *
 * Params (object):
 *   - userName     : chuoi tim kiem theo ten user
 *   - phone        : chuoi tim kiem theo so dien thoai
 *   - actionType   : LOGIN | LOGIN_FAILED
 *   - status       : active | ended | failed
 *   - startDate    : ngay bat dau (ISO string)
 *   - endDate      : ngay ket thuc (ISO string)
 *   - branchId     : ID chi nhanh
 *   - page         : so trang (mac dinh 1)
 *   - pageSize     : so ban ghi moi trang (mac dinh 20)
 *
 * Tra ve:
 *   - data       : { items, total, page, pageSize }
 *   - loading    : boolean
 *   - error      : Error | null
 *   - refetch()  : goi lai API
 *   - params     : params hien tai
 *   - setParams  : cap nhat params
 *   - updateParam: cap nhat mot filter, reset page ve 1
 */
export function useLoginSessions(initialParams = {}) {
  const [params, setParams] = useState({
    userName: '',
    phone: '',
    actionType: '',
    status: '',
    startDate: '',
    endDate: '',
    branchId: undefined,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    ...initialParams,
  });

  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [debouncedUserName, setDebouncedUserName] = useState(params.userName);
  const [debouncedPhone, setDebouncedPhone] = useState(params.phone);
  const debounceUserNameRef = useRef(null);
  const debouncePhoneRef = useRef(null);

  useEffect(() => {
    if (debounceUserNameRef.current) clearTimeout(debounceUserNameRef.current);
    debounceUserNameRef.current = setTimeout(() => setDebouncedUserName(params.userName), SEARCH_DEBOUNCE_MS);
    return () => { if (debounceUserNameRef.current) clearTimeout(debounceUserNameRef.current); };
  }, [params.userName]);

  useEffect(() => {
    if (debouncePhoneRef.current) clearTimeout(debouncePhoneRef.current);
    debouncePhoneRef.current = setTimeout(() => setDebouncedPhone(params.phone), SEARCH_DEBOUNCE_MS);
    return () => { if (debouncePhoneRef.current) clearTimeout(debouncePhoneRef.current); };
  }, [params.phone]);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.getLoginSessions({
        userName: debouncedUserName || undefined,
        phone: debouncedPhone || undefined,
        actionType: params.actionType || undefined,
        status: params.status || undefined,
        startDate: params.startDate || undefined,
        endDate: params.endDate || undefined,
        branchId: params.branchId,
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
  }, [
    debouncedUserName,
    debouncedPhone,
    params.actionType,
    params.status,
    params.startDate,
    params.endDate,
    params.branchId,
    params.page,
    params.pageSize,
  ]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateParam = useCallback((key, value) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  }, []);

  return { data, loading, error, refetch: fetch, params, setParams, updateParam };
}
