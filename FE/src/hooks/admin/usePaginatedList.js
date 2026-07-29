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

  // Ref lưu params hiện tại (không gây re-render)
  const paramsRef = useRef(params);

  // Ref lưu debounced values (dùng để merge vào params khi gọi API)
  const debouncedRef = useRef({});
  debounceKeys.forEach((k) => {
    if (!(k in debouncedRef.current)) debouncedRef.current[k] = params[k] ?? '';
  });

  // Timer refs cho từng key
  const timerRefs = useRef({});

  // Clean params (bỏ empty/undefined)
  function cleanParams(p) {
    const out = {};
    Object.entries(p).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  // API call function - stable reference
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
        stats: res?.stats ?? null,
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

  // Merge debounced values vào params hiện tại để tạo effective params
  function getEffectiveParams(currentParams) {
    const effective = { ...currentParams };
    debounceKeys.forEach((k) => {
      effective[k] = debouncedRef.current[k] ?? '';
    });
    return effective;
  }

  // Trigger gọi API với params hiện tại (đã merge debounced values)
  const triggerFetch = useCallback(() => {
    callApi(getEffectiveParams(paramsRef.current));
  }, [callApi]);

  // Effect gọi API khi page/pageSize thay đổi
  useEffect(() => {
    triggerFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.pageSize]);

  /**
   * Cập nhật 1 param:
   * - Luôn cập nhật state để UI phản hồi ngay
   * - Luôn reset page về 1 (trừ khi key là 'page')
   * - Gọi API sau khi state đã update (dùng setTimeout 0)
   */
  const updateParam = useCallback((key, value) => {
    const isDebounceKey = debounceKeys.includes(key);

    if (isDebounceKey) {
      // Cancel timer cũ (tránh race condition khi gõ nhanh)
      if (timerRefs.current[key]) {
        clearTimeout(timerRefs.current[key]);
      }

      // Cập nhật debouncedRef ngay để có giá trị mới nhất
      debouncedRef.current[key] = value ?? '';

      // Cập nhật state để UI phản hồi ngay (input hiển thị giá trị)
      setParamsState((prev) => {
        const next = { ...prev, [key]: value, page: 1 };
        paramsRef.current = next;
        return next;
      });

      // Gọi API SAU khi state update (dùng setTimeout 0)
      setTimeout(() => callApi(getEffectiveParams(paramsRef.current)), 0);
    } else {
      // Không phải debounce key: cập nhật state, sau đó gọi API với giá trị mới
      setParamsState((prev) => {
        const next = { ...prev, [key]: value, page: key === 'page' ? value : 1 };
        paramsRef.current = next;
        return next;
      });
      // Gọi API sau state update với params mới
      setTimeout(() => callApi(getEffectiveParams(paramsRef.current)), 0);
    }
  }, [debounceKeys, callApi]);

  const setParams = useCallback((updater) => {
    setParamsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      paramsRef.current = next;
      // Đồng bộ debounce ref để lần fetch dùng đúng giá trị seed/filter
      debounceKeys.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(next, k)) {
          debouncedRef.current[k] = next[k] ?? '';
        }
      });
      return next;
    });
    // Quan trọng: setParams trước đây chỉ cập nhật state, không gọi API
    // → seed từ cảnh báo ("Lịch sử") không lọc được dữ liệu.
    setTimeout(() => callApi(getEffectiveParams(paramsRef.current)), 0);
  }, [callApi, debounceKeys]);

  const refresh = useCallback(async () => {
    debounceKeys.forEach((key) => {
      debouncedRef.current[key] = paramsRef.current[key] ?? '';
    });
    await callApi(getEffectiveParams(paramsRef.current));
  }, [callApi, debounceKeys]);

  const refetch = useCallback(() => {
    callApi(getEffectiveParams(paramsRef.current));
  }, [callApi]);

  /**
   * Patch items inline (khong goi API). Dung cho SSE de update row
   * khi co event moi ma khong can refetch full page.
   */
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
