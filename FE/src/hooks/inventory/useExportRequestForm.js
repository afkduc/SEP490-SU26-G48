import { useState, useEffect, useCallback } from 'react';
import {
  listExportableRepairOrdersApi,
  getRepairOrderForExportApi,
  getExportTechniciansApi,
  createExportRequestApi,
} from '../../services/exportRequestApi';

/**
 * Hook phu trach trang Tao phieu xuat kho moi (NV Kho):
 * - listRepairOrders(search, page): goi API lay cac RO co the xuat.
 * - loadRepairOrder(id): goi API lay chi tiet 1 RO + tasks (PART) de fill form,
 *   kem chu ky khach da ky tren phieu quyet toan.
 * - technicians: danh sach tho may cho dropdown "Nguoi lay".
 * - submit(payload): tao phieu xuat (tru stock + ghi log). Ma phieu xuat =
 *   luon la ma cua Repair Order duoc chon, BE tu gan, khong can sinh truoc.
 */
export function useExportRequestForm(branchId) {
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

  // Danh sach tho may (dropdown "Nguoi lay")
  const [technicians, setTechnicians] = useState([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    let mounted = true;
    setLoadingTechnicians(true);
    getExportTechniciansApi({ branchId })
      .then((res) => { if (mounted) setTechnicians(res || []); })
      .catch(() => { if (mounted) setTechnicians([]); })
      .finally(() => { if (mounted) setLoadingTechnicians(false); });
    return () => { mounted = false; };
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
    submitting,
    submitError,
    submit,
    repairOrders,
    loadingRepairOrders,
    repairOrdersError,
    repairOrdersTotal,
    fetchRepairOrders,
    technicians,
    loadingTechnicians,
    loadingRoDetail,
    roDetailError,
    loadRepairOrder,
  };
}