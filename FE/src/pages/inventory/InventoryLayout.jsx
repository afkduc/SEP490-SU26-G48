import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth, normalizeRoles } from '../../contexts/AppContext';
import { ROLES } from '../../constants/roles';
import generalDirectorApi from '../../services/generalDirectorApi';
import { adminBranchesApi } from '../../services/adminApi';
import './InventoryLayout.css';

const InventoryBranchContext = createContext(null);

export function useInventoryBranch() {
  const context = useContext(InventoryBranchContext);
  if (!context) {
    throw new Error('useInventoryBranch must be used inside InventoryLayout');
  }
  return context;
}

function getBranchOptions(rawItems = []) {
  return rawItems
    .map((branch) => {
      const id = Number(branch?.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        label: branch.branchName || branch.branch_name || branch.name || branch.branch_code || `Chi nhánh #${id}`,
        isActive: branch.isActive !== false && branch.is_active !== false,
      };
    })
    .filter(Boolean)
    .filter((branch) => branch.isActive);
}

export default function InventoryLayout() {
  const { user } = useAuth();
  const roles = normalizeRoles(user?.roles);
  const isAdmin = roles.includes(ROLES.ADMIN);
  const isGeneralDirector = roles.includes(ROLES.GENERAL_DIRECTOR);
  const assignedBranchId = user?.branchId ? Number(user.branchId) : null;
  const hasGlobalBranchSelector = !assignedBranchId && (isGeneralDirector || isAdmin);

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(assignedBranchId);
  const [loadingBranches, setLoadingBranches] = useState(hasGlobalBranchSelector);
  const [branchError, setBranchError] = useState('');

  useEffect(() => {
    if (assignedBranchId) {
      setSelectedBranchId(assignedBranchId);
      setBranches([]);
      setBranchError('');
      setLoadingBranches(false);
      return undefined;
    }

    if (!hasGlobalBranchSelector) {
      setSelectedBranchId(null);
      setBranches([]);
      setBranchError('');
      setLoadingBranches(false);
      return undefined;
    }

    let mounted = true;
    setLoadingBranches(true);
    setBranchError('');

    const fetchBranches = isAdmin
      ? adminBranchesApi.list()
      : generalDirectorApi.getBranches();

    Promise.resolve(fetchBranches)
      .then((res) => {
        if (!mounted) return;
        const branchOptions = getBranchOptions(Array.isArray(res) ? res : (res?.items || res?.branches || []));
        setBranches(branchOptions);
        setSelectedBranchId((current) => current || branchOptions[0]?.id || null);
      })
      .catch((error) => {
        if (mounted) {
          setBranches([]);
          setBranchError(error?.message || 'Không tải được danh sách chi nhánh');
        }
      })
      .finally(() => {
        if (mounted) setLoadingBranches(false);
      });

    return () => {
      mounted = false;
    };
  }, [assignedBranchId, hasGlobalBranchSelector, isAdmin]);

  const value = useMemo(() => ({
    branchId: assignedBranchId || selectedBranchId || null,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    loadingBranches,
    branchError,
    hasGlobalBranchSelector,
  }), [assignedBranchId, selectedBranchId, branches, loadingBranches, branchError, hasGlobalBranchSelector]);

  return (
    <InventoryBranchContext.Provider value={value}>
      <div className="inv-layout">
        {hasGlobalBranchSelector && (
          <div className="inv-layout__branch-bar">
            <label className="inv-layout__branch-label" htmlFor="inventory-branch-select">
              Chi nhánh đang xem
            </label>
            <select
              id="inventory-branch-select"
              className="input inv-layout__branch-select"
              value={selectedBranchId || ''}
              onChange={(event) => setSelectedBranchId(Number(event.target.value) || null)}
              disabled={loadingBranches}
            >
              <option value="">{loadingBranches ? 'Đang tải...' : 'Chọn chi nhánh'}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
            {branchError && <span className="inv-layout__branch-error">{branchError}</span>}
          </div>
        )}
        <Outlet />
      </div>
    </InventoryBranchContext.Provider>
  );
}
