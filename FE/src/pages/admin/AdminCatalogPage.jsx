import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminBranchesPage from './AdminBranchesPage';
import AdminSpecialtiesPage from './AdminSpecialtiesPage';
import AdminVehicleBrandsPage from './AdminVehicleBrandsPage';
import './AdminHub.css';

const TABS = [
  { id: 'branches', label: 'Chi nhánh' },
  { id: 'specialties', label: 'Chuyên môn' },
  { id: 'brands', label: 'Hãng xe' },
];

const VALID = new Set(TABS.map((t) => t.id));

function IconCatalog() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export default function AdminCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab');
  const activeTab = VALID.has(raw) ? raw : 'branches';

  const setActiveTab = useCallback((tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'branches') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return (
    <div className="admin-page admin-hub">
      <div className="admin-hub__header">
        <div className="admin-hub__title-block">
          <div className="admin-hub__title-icon">
            <IconCatalog />
          </div>
          <div className="admin-hub__title-group">
            <h1>Danh mục hệ thống</h1>
            <p className="admin-hub__subtitle">
              Chi nhánh · Chuyên môn · Hãng xe — dữ liệu dùng chung toàn hệ thống
            </p>
          </div>
        </div>
      </div>

      <nav className="admin-hub__tabs" aria-label="Danh mục hệ thống">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-hub__tab${activeTab === tab.id ? ' admin-hub__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="admin-hub__body">
        {activeTab === 'branches' && <AdminBranchesPage embedded />}
        {activeTab === 'specialties' && <AdminSpecialtiesPage embedded />}
        {activeTab === 'brands' && <AdminVehicleBrandsPage embedded />}
      </div>
    </div>
  );
}
