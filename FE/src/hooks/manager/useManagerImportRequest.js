import { useState, useEffect, useCallback } from 'react';
import {
  getManagerImportRequestByIdApi,
  approveManagerImportRequestApi,
  rejectManagerImportRequestApi,
} from '../../services/managerImportRequestApi';

/**
 * Hook cho trang Manager > Chi tiet phieu nhap:
 * - Load chi tiet phieu.
 * - approve() / reject() (duyet/tu choi phieu -> server transaction cong stock).
 */
export function useManagerImportRequest(id) {
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
      const res = await getManagerImportRequestByIdApi(id);
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

  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState(null);

  const approve = useCallback(async () => {
    setActing(true);
    setActionError(null);
    try {
      const updated = await approveManagerImportRequestApi(id);
      setData(updated);
      return updated;
    } catch (err) {
      setActionError(err.message);
      throw err;
    } finally {
      setActing(false);
    }
  }, [id]);

  const reject = useCallback(async (rejectReason) => {
    setActing(true);
    setActionError(null);
    try {
      const updated = await rejectManagerImportRequestApi(id, { rejectReason });
      setData(updated);
      return updated;
    } catch (err) {
      setActionError(err.message);
      throw err;
    } finally {
      setActing(false);
    }
  }, [id]);

  return {
    data,
    loading,
    error,
    acting,
    actionError,
    approve,
    reject,
    refetch: fetchOne,
  };
}