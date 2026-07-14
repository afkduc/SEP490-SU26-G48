import { useState, useCallback } from 'react';
import {
  approveImportRequestApi,
  rejectImportRequestApi,
} from '../../services/importRequestApi';

/**
 * Hook xu ly 2 action duyet / tu choi phieu nhap.
 * Tra ve data phieu moi sau khi BE xu ly xong.
 */
export function useImportRequestApproval(onSuccess) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState(null);

  const approve = useCallback(async (id) => {
    setApproving(true);
    setError(null);
    try {
      const res = await approveImportRequestApi(id);
      if (onSuccess) onSuccess(res);
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setApproving(false);
    }
  }, [onSuccess]);

  const reject = useCallback(async (id, rejectReason) => {
    setRejecting(true);
    setError(null);
    try {
      const res = await rejectImportRequestApi(id, { rejectReason });
      if (onSuccess) onSuccess(res);
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setRejecting(false);
    }
  }, [onSuccess]);

  return { approve, reject, approving, rejecting, error };
}