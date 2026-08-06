import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth, normalizeRoles } from './AppContext';
import { ROLES } from '../constants/roles';
import { getNewProductsCountApi } from '../services/productApi';

// So san pham do Nhan vien kho tao ma Quan ly chua xem qua (dung de hien so
// do canh "Kho chi nhanh" tren menu, va gan cham do tren tung dong san pham
// moi trong man Kho phu tung). Chia se giua Navbar va ManagerInventoryPage.
const ManagerInventoryNotifyContext = createContext(null);

export function ManagerInventoryNotifyProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const isManager = isAuthenticated && normalizeRoles(user?.roles).includes(ROLES.MANAGER);
  const [newProductCount, setNewProductCount] = useState(0);

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

  useEffect(() => {
    refreshNewProductCount();
  }, [refreshNewProductCount]);

  // Goi ngay khi 1 dong san pham vua duoc danh dau "da xem" (hover) - tru bot
  // 1 mà khong can goi lai API dem tong so.
  const decrementNewProductCount = useCallback(() => {
    setNewProductCount((c) => Math.max(0, c - 1));
  }, []);

  return (
    <ManagerInventoryNotifyContext.Provider
      value={{ newProductCount, refreshNewProductCount, decrementNewProductCount }}
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
