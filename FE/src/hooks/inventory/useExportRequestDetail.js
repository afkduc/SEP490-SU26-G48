import { useState, useEffect, useCallback } from 'react';
import { getExportRequestByIdApi } from '../../services/exportRequestApi';

/**
 * Hook cho trang Chi tiet phieu xuat kho (Warehouse Staff).
 */
export function useExportRequestDetail(id) {
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
      const res = await getExportRequestByIdApi(id);
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