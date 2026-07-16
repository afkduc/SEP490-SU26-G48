import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_DEBOUNCE_MS = 400;

/**
 * Hook generic cho các trang admin có danh sách phân trang + filter.
 * Hook này KHÔNG tự fetch — caller chịu trách nhiệm gọi `refetch` từ useEffect
 * theo dõi `params` và `debouncedValues`. Điều này tránh auto-fetch logic mơ hồ.
 *
 * @param {Object}   options
 * @param {Function} options.apiFn          Hàm gọi API, nhận (params) → Promise<{items,total,page,pageSize}>
 * @param {Object}   options.defaultParams  Params khởi tạo
 * @param {string[]} [options.debounceKeys] Tên field cần debounce
 * @param {number}   [options.debounceMs]   Thời gian debounce (ms)
 *
 * Trả về:
 *   { data, loading, error, refetch, refresh, params, setParams, updateParam, effectiveParams }
 */
export function usePaginatedList({
  apiFn,
  defaultParams = {},
  debounceKeys = [],
  debounceMs = DEFAULT_DEBOUNCE_MS,
}) {
  const initialParams = {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    ...defaultParams,
  };

  const [params, setParams] = useState(initialParams);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce cache
  const debouncedRef = useRef({});
  debounceKeys.forEach((k) => {
    if (!(k in debouncedRef.current)) debouncedRef.current[k] = params[k] ?? '';
  });
  const [, forceTick] = useState(0);

  // Setup debounce: mỗi lần params[key] đổi, schedule flush sau debounceMs
  useEffect(() => {
    if (debounceKeys.length === 0) return undefined;
    const timeouts = debounceKeys.map((key) => {
      const id = setTimeout(() => {
        debouncedRef.current[key] = params[key] ?? '';
        forceTick((n) => n + 1);
      }, debounceMs);
      return id;
    });
    return () => {
      timeouts.forEach((id) => clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...debounceKeys.map((k) => params[k]), debounceMs]);

  // Build params để gọi API
  const effectiveParams = useCallback(() => {
    const out = { ...params };
    debounceKeys.forEach((key) => {
      out[key] = debouncedRef.current[key] ?? '';
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, debounceKeys.join('|')]);

  // Clean params (bỏ empty)
  function cleanParams(p) {
    const out = {};
    Object.entries(p).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  const callApi = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(cleanParams(p));
      const items = res?.items ?? res ?? [];
      setData({
        items: Array.isArray(items) ? items : [],
        total: res?.total ?? (Array.isArray(items) ? items.length : 0),
        page: Number(res?.page || p.page || 1),
        pageSize: Number(res?.pageSize || p.pageSize || DEFAULT_PAGE_SIZE),
      });
    } catch (err) {
      setError(err);
      setData({ items: [], total: 0, page: p.page || 1, pageSize: p.pageSize || DEFAULT_PAGE_SIZE });
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  // Auto fetch khi params đổi (bao gồm cả debounced keys)
  const debouncedSnapshot = JSON.stringify(debouncedRef.current);
  useEffect(() => {
    callApi(effectiveParams());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize, debouncedSnapshot, ...Object.keys(params).filter((k) => !debounceKeys.includes(k)).flatMap((k) => [params[k]])]);

  const updateParam = useCallback((key, value) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
    if (debounceKeys.includes(key)) {
      debouncedRef.current[key] = ''; // Reset cache → effect sẽ đợi debounce flush
    }
  }, [debounceKeys]);

  const refresh = useCallback(async () => {
    // Force-flush debounce
    debounceKeys.forEach((key) => {
      debouncedRef.current[key] = params[key] ?? '';
    });
    forceTick((n) => n + 1);
    await callApi(effectiveParams());
  }, [callApi, effectiveParams, params, debounceKeys]);

  return {
    data,
    loading,
    error,
    refetch: () => callApi(effectiveParams()),
    refresh,
    params,
    setParams,
    updateParam,
  };
}