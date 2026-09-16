import { useState, useEffect, useCallback } from 'react';
import { getProductByIdApi, getProductStockHistoryApi } from '../../services/productApi';

/**
 * Tai chi tiet mot phu tung + lich su bien dong ton kho. Tu dong fetch khi
 * partId thay doi.
 */
export function usePartDetail(partId) {
  const [part, setPart] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!partId) return;
    setLoading(true);
    setError(null);
    try {
      const [res, hist] = await Promise.all([
        getProductByIdApi(partId),
        // Lich su chi la thong tin phu - loi thi bo qua, khong chan trang.
        getProductStockHistoryApi(partId).catch(() => null),
      ]);
      setPart(res);
      setHistory(hist);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [partId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { part, history, loading, error, refetch: fetch };
}
