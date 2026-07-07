import { useState, useEffect, useCallback } from 'react';
import { getPartByIdApi, getStockHistoryApi } from '../../services/partMockApi';

/**
 * Tai chi tiet mot part va lich su ton kho. Tu dong fetch khi partId thay doi.
 * @param {number|string|null} partId
 */
export function usePartDetail(partId) {
  const [part, setPart] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Tai chi tiet part va lich su giao dich cung luc (Promise.all).
   */
  const fetch = useCallback(async () => {
    if (!partId) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, historyRes] = await Promise.all([
        getPartByIdApi(partId),
        getStockHistoryApi(partId),
      ]);
      setPart(detailRes.data);
      setHistory(historyRes.data);
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
