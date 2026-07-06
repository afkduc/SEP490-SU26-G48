import { useState, useEffect, useCallback } from 'react';
import { getSupplierByIdApi, updateSupplierApi } from '../../services/inventoryMockApi';
import { mockParts } from '../../mocks/inventoryMockData';

export function useSupplierDetail(id) {
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getSupplierByIdApi(id);
      setSupplier(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = useCallback(async (payload) => {
    setSaving(true);
    try {
      const res = await updateSupplierApi(id, payload);
      setSupplier(res.data);
      return res.data;
    } finally {
      setSaving(false);
    }
  }, [id]);

  const partsFromSupplier = mockParts.filter((p) => p.supplierId === Number(id));

  return { supplier, loading, error, saving, save, refetch: fetch, partsFromSupplier };
}
