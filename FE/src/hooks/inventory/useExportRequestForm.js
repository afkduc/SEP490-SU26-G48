import { useState, useEffect, useCallback } from 'react';
import {
  getNextExportRequestCodeApi,
  listExportableRepairOrdersApi,
  getRepairOrderForExportApi,
  createExportRequestApi,
} from '../../services/exportRequestApi';

/**
 * Hook phu trach trang Tao phieu xuat kho moi (NV Kho):
 * - Auto load ma phieu tiep theo (EXB-{branchId}-{YYYYMMDD}-{seq}).
 * - listRepairOrders(search, page): goi API lay cac RO co the xuat.
 * - loadRepairOrder(id): goi API lay chi tiet 1 RO + tasks (PART) de fill form.
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

  // Repair Order helpers
  const [repairOrders, setRepairOrders] = useState([]);
  const [loadingRepairOrders, setLoadingRepairOrders] = useState(false);
  const [repairOrdersError, setRepairOrdersError] = useState(null);
  const [repairOrdersTotal, setRepairOrdersTotal] = useState(0);

  const fetchRepairOrders = useCallback(async (search = '') => {
    if (!branchId) return;
    setLoadingRepairOrders(true);
    setRepairOrdersError(null);
    try {
      const res = await listExportableRepairOrdersApi({ branchId, search });
      setRepairOrders(res?.items || []);
      setRepairOrdersTotal(res?.total || 0);
    } catch (err) {
      setRepairOrdersError(err.message);
      setRepairOrders([]);
    } finally {
      setLoadingRepairOrders(false);
    }
  }, [branchId]);

  const [loadingRoDetail, setLoadingRoDetail] = useState(false);
  const [roDetailError, setRoDetailError] = useState(null);

  const loadRepairOrder = useCallback(async (id) => {
    if (!id) return null;
    setLoadingRoDetail(true);
    setRoDetailError(null);
    try {
      const res = await getRepairOrderForExportApi(id);
      return res;
    } catch (err) {
      setRoDetailError(err.message);
      throw err;
    } finally {
      setLoadingRoDetail(false);
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
    repairOrders,
    loadingRepairOrders,
    repairOrdersError,
    repairOrdersTotal,
    fetchRepairOrders,
    loadingRoDetail,
    roDetailError,
    loadRepairOrder,
  };
}