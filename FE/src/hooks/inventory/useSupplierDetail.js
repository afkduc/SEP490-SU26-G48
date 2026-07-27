import { useState, useEffect, useCallback } from 'react';
import { getSupplierByIdApi } from '../../services/supplierApi';
import { getProductsApi } from '../../services/productApi';

/**
 * Lay chi tiet mot nha cung cap (read-only).
 * Dong thoi lay danh sach phu tung dang duoc cung cap boi NCC do.
 */
export function useSupplierDetail(id) {
  const [supplier, setSupplier] = useState(null);
  const [partsFromSupplier, setPartsFromSupplier] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const supplierRes = await getSupplierByIdApi(id);
      setSupplier(supplierRes);

      // Lay cac phu tung dang supplier_id = id (khong can truyen branchId, BE se tra full).
      try {
        const allProductsRes = await getProductsApi({ status: 'active' });
        const list = allProductsRes.items || [];
        setPartsFromSupplier(list.filter((p) => Number(p.supplierId) === Number(id)));
      } catch (innerErr) {
        // Loi lay phu tu khong anh huong den flow chinh.
        setPartsFromSupplier([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { supplier, partsFromSupplier, loading, error, refetch: fetch };
}