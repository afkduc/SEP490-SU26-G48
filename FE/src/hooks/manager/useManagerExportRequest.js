import { useState, useEffect, useCallback } from 'react';
import { getManagerExportRequestByIdApi } from '../../services/managerExportRequestApi';

/**
 * Hook cho trang Manager > Chi tiet phieu xuat kho (read-only).
 */
export function useManagerExportRequest(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOne = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getManagerExportRequestByIdApi(id);
      setData(res || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOne();
  }, [fetchOne]);

  return { data, loading, error, refetch: fetchOne, setData };
}