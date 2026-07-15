import { useState, useEffect, useCallback } from 'react';
import {
  getNextExportRequestCodeApi,
  listExportableServiceOrdersApi,
  getServiceOrderForExportApi,
  createExportRequestApi,
} from '../../services/exportRequestApi';

/**
 * Hook phu trach trang Tao phieu xuat kho moi (NV Kho):
 * - Auto load ma phieu tiep theo (EXB-{branchId}-{YYYYMMDD}-{seq}).
 * - listServiceOrders(search, page): goi API lay cac SO co the xuat.
 * - loadServiceOrder(id): goi API lay chi tiet 1 SO + items (de fill form).
 * - submit(payload): tao phieu xuat (tru stock + ghi log).
 */
export function useExportRequestForm(branchId) {
  const [nextCode, setNextCode] = useState('');
  const [codeDate, setCodeDate] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState(null);

  const fetchNextCode = useCallback(async () => {
    if (!branchId) return;
    setLoadingCode(true);
    setCodeError(null);
    try {
      const res = await getNextExportRequestCodeApi({ branchId });
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
      const res = await createExportRequestApi(payload);
      return res;
    } catch (err) {
      setSubmitError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  // Service Order helpers
  const [serviceOrders, setServiceOrders] = useState([]);
  const [loadingServiceOrders, setLoadingServiceOrders] = useState(false);
  const [serviceOrdersError, setServiceOrdersError] = useState(null);

  const fetchServiceOrders = useCallback(async (search = '') => {
    if (!branchId) return;
    setLoadingServiceOrders(true);
    setServiceOrdersError(null);
    try {
      const res = await listExportableServiceOrdersApi({ branchId, search });
      setServiceOrders(res?.items || []);
    } catch (err) {
      setServiceOrdersError(err.message);
      setServiceOrders([]);
    } finally {
      setLoadingServiceOrders(false);
    }
  }, [branchId]);

  const [loadingSoDetail, setLoadingSoDetail] = useState(false);
  const [soDetailError, setSoDetailError] = useState(null);

  const loadServiceOrder = useCallback(async (id) => {
    if (!id) return null;
    setLoadingSoDetail(true);
    setSoDetailError(null);
    try {
      const res = await getServiceOrderForExportApi(id);
      return res;
    } catch (err) {
      setSoDetailError(err.message);
      throw err;
    } finally {
      setLoadingSoDetail(false);
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
    serviceOrders,
    loadingServiceOrders,
    serviceOrdersError,
    fetchServiceOrders,
    loadingSoDetail,
    soDetailError,
    loadServiceOrder,
  };
}