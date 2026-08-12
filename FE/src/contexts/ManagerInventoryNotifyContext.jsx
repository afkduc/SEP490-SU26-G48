import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth, normalizeRoles } from './AppContext';
import { ROLES } from '../constants/roles';
import { getNewProductsCountApi } from '../services/productApi';
import { getNewImportRequestsCountApi } from '../services/managerImportRequestApi';
import { getNewExportRequestsCountApi } from '../services/managerExportRequestApi';

// So san pham / phieu nhap / phieu xuat do Nhan vien kho tao ma Quan ly chua
// xem qua (dung de hien so do canh cac muc "Kho chi nhanh", "Phieu nhap",
// "Phieu xuat" tren menu, va gan cham do tren tung dong moi). Chia se giua
// Navbar va cac trang Kho cua Manager.
const ManagerInventoryNotifyContext = createContext(null);

export function ManagerInventoryNotifyProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const isManager = isAuthenticated && normalizeRoles(user?.roles).includes(ROLES.MANAGER);
  const [newProductCount, setNewProductCount] = useState(0);
  const [newImportRequestCount, setNewImportRequestCount] = useState(0);
  const [newExportRequestCount, setNewExportRequestCount] = useState(0);

  const refreshNewProductCount = useCallback(async () => {
    if (!isManager) {
      setNewProductCount(0);
      return;
    }
    try {
      const res = await getNewProductsCountApi();
      setNewProductCount(res?.count || 0);
    } catch {
      // Chi la 1 con so thong bao phu - loi thi bo qua, khong lam gian doan UI.
    }
  }, [isManager]);

  const refreshNewImportRequestCount = useCallback(async () => {
    if (!isManager) {
      setNewImportRequestCount(0);
      return;
    }
    try {
      const res = await getNewImportRequestsCountApi();
      setNewImportRequestCount(res?.count || 0);
    } catch {
      // Chi la 1 con so thong bao phu - loi thi bo qua, khong lam gian doan UI.
    }
  }, [isManager]);

  const refreshNewExportRequestCount = useCallback(async () => {
    if (!isManager) {
      setNewExportRequestCount(0);
      return;
    }
    try {
      const res = await getNewExportRequestsCountApi();
      setNewExportRequestCount(res?.count || 0);
    } catch {
      // Chi la 1 con so thong bao phu - loi thi bo qua, khong lam gian doan UI.
    }
  }, [isManager]);

  useEffect(() => {
    refreshNewProductCount();
    refreshNewImportRequestCount();
    refreshNewExportRequestCount();
  }, [refreshNewProductCount, refreshNewImportRequestCount, refreshNewExportRequestCount]);

  // Goi ngay khi 1 dong san pham vua duoc danh dau "da xem" (hover) - tru bot
  // 1 mà khong can goi lai API dem tong so.
  const decrementNewProductCount = useCallback(() => {
    setNewProductCount((c) => Math.max(0, c - 1));
  }, []);

  // Goi ngay khi 1 phieu nhap/xuat vua duoc danh dau "da xem" (mo trang chi tiet).
  const decrementNewImportRequestCount = useCallback(() => {
    setNewImportRequestCount((c) => Math.max(0, c - 1));
  }, []);

  const decrementNewExportRequestCount = useCallback(() => {
    setNewExportRequestCount((c) => Math.max(0, c - 1));
  }, []);

  return (
    <ManagerInventoryNotifyContext.Provider
      value={{
        newProductCount, refreshNewProductCount, decrementNewProductCount,
        newImportRequestCount, refreshNewImportRequestCount, decrementNewImportRequestCount,
        newExportRequestCount, refreshNewExportRequestCount, decrementNewExportRequestCount,
      }}
    >
      {children}
    </ManagerInventoryNotifyContext.Provider>
  );
}

export function useManagerInventoryNotify() {
  const ctx = useContext(ManagerInventoryNotifyContext);
  if (!ctx) throw new Error('useManagerInventoryNotify must be used inside ManagerInventoryNotifyProvider');
  return ctx;
}
