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

  const paramsRef = useRef(params);
  const apiFnRef = useRef(apiFn);
  apiFnRef.current = apiFn;

  const debounceKeysRef = useRef(debounceKeys);
  debounceKeysRef.current = debounceKeys;

  const debouncedRef = useRef({});
  // Đồng bộ key debounce lần đầu (và khi danh sách key đổi)
  debounceKeys.forEach((k) => {
    if (!(k in debouncedRef.current)) {
      debouncedRef.current[k] = initialParams[k] ?? '';
    }
  });

  const timerRefs = useRef({});
  const fetchSeqRef = useRef(0);
  const debounceMsRef = useRef(debounceMs);
  debounceMsRef.current = debounceMs;
  const mountedFetchDoneRef = useRef(false);

  function cleanParams(p) {
    const out = {};
    Object.entries(p).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  function getEffectiveParams(currentParams) {
    const effective = { ...currentParams };
    debounceKeysRef.current.forEach((k) => {
      effective[k] = debouncedRef.current[k] ?? '';
    });
    return effective;
  }

  const callApi = useCallback(async (p) => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFnRef.current(cleanParams(p));
      // Bỏ qua response cũ nếu đã có request mới hơn
      if (seq !== fetchSeqRef.current) return;
      const items = res?.items ?? res ?? [];
      setData({
        items: Array.isArray(items) ? items : [],
        total: res?.total ?? (Array.isArray(items) ? items.length : 0),
        page: Number(res?.page || p.page || 1),
        pageSize: Number(res?.pageSize || p.pageSize || DEFAULT_PAGE_SIZE),
        stats: res?.stats ?? null,
      });
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError(err);
      setData({
        items: [],
        total: 0,
        page: p.page || 1,
        pageSize: p.pageSize || DEFAULT_PAGE_SIZE,
      });
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach(clearTimeout);
    };
  }, []);

  // Mount: fetch lần đầu với params hiện tại (gồm seedDefaults)
  useEffect(() => {
    if (mountedFetchDoneRef.current) return;
    mountedFetchDoneRef.current = true;
    callApi(getEffectiveParams(paramsRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callApi]);

  /**
   * Cập nhật 1 param:
   * - UI cập nhật ngay
   * - Ô text (debounceKeys): chờ debounceMs rồi mới gọi API (tránh gọi API mỗi phím)
   * - Filter khác: gọi API ngay
   */
  const updateParam = useCallback(
    (key, value) => {
      const isDebounceKey = debounceKeysRef.current.includes(key);

      setParamsState((prev) => {
        const next = { ...prev, [key]: value, page: key === 'page' ? value : 1 };
        paramsRef.current = next;
        return next;
      });

      if (isDebounceKey) {
        // Đồng bộ ngay để API luôn dùng đúng chuỗi đang nhập (AND với các field khác)
        debouncedRef.current[key] = value ?? '';
        if (timerRefs.current[key]) clearTimeout(timerRefs.current[key]);
        timerRefs.current[key] = setTimeout(() => {
          timerRefs.current[key] = null;
          callApi(getEffectiveParams(paramsRef.current));
        }, debounceMsRef.current);
        return;
      }

      // Đổi page / filter select: hủy debounce text đang chờ rồi fetch ngay với giá trị UI hiện tại
      Object.keys(timerRefs.current).forEach((k) => {
        clearTimeout(timerRefs.current[k]);
        delete timerRefs.current[k];
      });
      // Đồng bộ debounce keys từ params (tránh mất chữ đang gõ)
      debounceKeysRef.current.forEach((k) => {
        debouncedRef.current[k] = paramsRef.current[k] ?? '';
      });
      setTimeout(() => callApi(getEffectiveParams(paramsRef.current)), 0);
    },
    [callApi]
  );

  const setParams = useCallback(
    (updater) => {
      setParamsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        paramsRef.current = next;
        debounceKeysRef.current.forEach((k) => {
          if (Object.prototype.hasOwnProperty.call(next, k)) {
            debouncedRef.current[k] = next[k] ?? '';
          }
        });
        return next;
      });
      // Hủy debounce đang chờ — setParams (reset/seed) phải fetch ngay
      Object.keys(timerRefs.current).forEach((k) => {
        clearTimeout(timerRefs.current[k]);
        delete timerRefs.current[k];
      });
      setTimeout(() => callApi(getEffectiveParams(paramsRef.current)), 0);
    },
    [callApi]
  );

  const refresh = useCallback(async () => {
    debounceKeysRef.current.forEach((key) => {
      debouncedRef.current[key] = paramsRef.current[key] ?? '';
    });
    await callApi(getEffectiveParams(paramsRef.current));
  }, [callApi]);

  const refetch = useCallback(() => {
    callApi(getEffectiveParams(paramsRef.current));
  }, [callApi]);

  const setItems = useCallback((updater) => {
    setData((prev) => {
      const nextItems = typeof updater === 'function' ? updater(prev.items) : updater;
      return { ...prev, items: Array.isArray(nextItems) ? nextItems : [] };
    });
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    refresh,
    params,
    setParams,
    updateParam,
    setItems,
  };
}
