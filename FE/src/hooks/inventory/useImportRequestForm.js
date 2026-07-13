import { useState, useEffect, useCallback } from 'react';
import {
  getNextImportRequestCodeApi,
  createImportRequestApi,
} from '../../services/importRequestApi';

/**
 * Hook phu trach trang Tao phieu nhap moi:
 * - Auto load ma phieu tiep theo khi mo form (IRB-{branchId}-{YYYYMMDD}-{seq}).
 * - submit() gui payload len BE, tra ve id phieu vua tao (de redirect sang detail).
 */
export function useImportRequestForm(branchId) {
  const [nextCode, setNextCode] = useState('');
  const [codeDate, setCodeDate] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState(null);

  const fetchNextCode = useCallback(async () => {
    if (!branchId) return;
    setLoadingCode(true);
    setCodeError(null);
    try {
      const res = await getNextImportRequestCodeApi({ branchId });
      setNextCode(res?.requestCode || '');
      setCodeDate(res?.date || '');
    } catch (err) {
      setCodeError(err.message);
    } finally {
      setLoadingCode(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchNextCode();
  }, [fetchNextCode]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const submit = useCallback(async (payload) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createImportRequestApi(payload);
      return res;
    } catch (err) {
      setSubmitError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return {
    nextCode,
    codeDate,
    loadingCode,
    codeError,
    refetchCode: fetchNextCode,
    submitting,
    submitError,
    submit,
  };
}