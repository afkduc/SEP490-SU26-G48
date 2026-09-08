import { useState, useEffect, useCallback } from 'react';
import { getProductByIdApi } from '../../services/productApi';

/**
 * Tai chi tiet mot phu tung. Tu dong fetch khi partId thay doi.
 */
export function usePartDetail(partId) {
  const [part, setPart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!partId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getProductByIdApi(partId);
      setPart(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [partId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { part, loading, error, refetch: fetch };
}