import { useState, useEffect, useCallback } from 'react';
import { getImportRequestByIdApi } from '../../services/importRequestApi';

/**
 * Load chi tiet 1 phieu nhap kem items. Tu dong refresh khi id thay doi.
 */
export function useImportRequestDetail(id) {
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
      const res = await getImportRequestByIdApi(id);
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