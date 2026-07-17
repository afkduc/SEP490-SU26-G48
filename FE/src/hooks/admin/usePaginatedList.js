import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_DEBOUNCE_MS = 400;

/**
 * Hook generic cho các trang admin có danh sách phân trang + filter.
 *
 * @param {Object}   options
 * @param {Function} options.apiFn          Hàm gọi API, nhận (params) → Promise<{items,total,page,pageSize}>
 * @param {Object}   options.defaultParams  Params khởi tạo
 * @param {string[]} [options.debounceKeys] Tên field cần debounce (text search)
 * @param {number}   [options.debounceMs]  Thời gian debounce (ms)
 *
 * Trả về:
 *   { data, loading, error, refetch, refresh, params, setParams, updateParam }
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

  const [params, setParamsState] = useState(initialParams);
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dùng ref để lưu trữ params hiện tại (không gây re-render)
  const paramsRef = useRef(params);

  // Debounce cache - ref lưu trữ debounced values
  const debouncedRef = useRef({});
  debounceKeys.forEach((k) => {
    if (!(k in debouncedRef.current)) debouncedRef.current[k] = params[k] ?? '';
  });

  // Trigger để useEffect re-run khi debounce flush
  const [debouncedVersion, setDebouncedVersion] = useState(0);

  // Timer refs cho từng key
  const timerRefs = useRef({});

  // Clean params (bỏ empty)
  function cleanParams(p) {
    const out = {};
    Object.entries(p).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  // API call function
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach(clearTimeout);
    };
  }, []);

  // Setup debounce cho debounceKeys
  useEffect(() => {
    debounceKeys.forEach((key) => {
      if (timerRefs.current[key]) {
        clearTimeout(timerRefs.current[key]);
      }
      timerRefs.current[key] = setTimeout(() => {
        debouncedRef.current[key] = paramsRef.current[key] ?? '';
        setDebouncedVersion((v) => v + 1);
      }, debounceMs);
    });

    return () => {
      debounceKeys.forEach((key) => {
        if (timerRefs.current[key]) {
          clearTimeout(timerRefs.current[key]);
        }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceKeys.join(','), debounceMs]);

  // Auto fetch khi: page/pageSize thay đổi HOẶC debounce flush
  useEffect(() => {
    const effectiveParams = { ...paramsRef.current };
    debounceKeys.forEach((key) => {
      effectiveParams[key] = debouncedRef.current[key] ?? '';
    });
    callApi(effectiveParams);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize, debouncedVersion]);

  const setParams = useCallback((updater) => {
    setParamsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      paramsRef.current = next;
      return next;
    });
  }, []);

  const updateParam = useCallback((key, value) => {
    // Immediate update debouncedRef (không chờ debounce)
    if (debounceKeys.includes(key)) {
      debouncedRef.current[key] = value ?? '';
    }
    setParamsState((prev) => {
      const next = {
        ...prev,
        [key]: value,
        page: key === 'page' ? value : 1,
      };
      paramsRef.current = next;
      return next;
    });
  }, [debounceKeys]);

  const refresh = useCallback(async () => {
    debounceKeys.forEach((key) => {
      debouncedRef.current[key] = paramsRef.current[key] ?? '';
    });
    setDebouncedVersion((v) => v + 1);
    await callApi({ ...paramsRef.current });
  }, [callApi, debounceKeys]);

  const refetch = useCallback(() => {
    const effectiveParams = { ...paramsRef.current };
    debounceKeys.forEach((key) => {
      effectiveParams[key] = debouncedRef.current[key] ?? '';
    });
    callApi(effectiveParams);
  }, [callApi, debounceKeys]);

  return {
    data,
    loading,
    error,
    refetch,
    refresh,
    params,
    setParams,
    updateParam,
  };
}
