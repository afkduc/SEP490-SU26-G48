import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { adminBranchesApi, adminRolesApi } from '../services/adminApi';
import { useAuth } from './AppContext';

const SharedDataContext = createContext(null);

export function SharedDataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const shouldLoadAdminData = isAuthenticated && location.pathname.startsWith('/admin');
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState(null);
  const [rolesError, setRolesError] = useState(null);

  const fetchBranches = useCallback(async () => {
    setBranchesLoading(true);
    setBranchesError(null);
    try {
      const res = await adminBranchesApi.list();
      setBranches(res?.items || []);
    } catch (err) {
      setBranchesError(err.message || 'Không tải được chi nhánh');
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    setRolesError(null);
    try {
      const res = await adminRolesApi.list();
      setRoles(res?.items || []);
    } catch (err) {
      setRolesError(err.message || 'Không tải được vai trò');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldLoadAdminData) {
      setBranchesLoading(false);
      setRolesLoading(false);
      return;
    }
    fetchBranches();
    fetchRoles();
  }, [shouldLoadAdminData, fetchBranches, fetchRoles]);

  const refreshBranches = useCallback(() => fetchBranches(), [fetchBranches]);
  const refreshRoles = useCallback(() => fetchRoles(), [fetchRoles]);

  return (
    <SharedDataContext.Provider value={{
      branches, roles,
      branchesLoading, rolesLoading,
      branchesError, rolesError,
      refreshBranches, refreshRoles,
    }}>
      {children}
    </SharedDataContext.Provider>
  );
}

export function useSharedBranches() {
  const ctx = useContext(SharedDataContext);
  if (!ctx) throw new Error('useSharedBranches must be inside SharedDataProvider');
  return ctx;
}

export function useSharedRoles() {
  const ctx = useContext(SharedDataContext);
  if (!ctx) throw new Error('useSharedRoles must be inside SharedDataProvider');
  return ctx;
}
