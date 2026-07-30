import AdminBranchesPage from './AdminBranchesPage';
import './AdminHub.css';

function IconCatalog() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

/** Danh mục hệ thống — hiện chỉ quản lý chi nhánh (chuyên môn gán qua hồ sơ user / manager). */
export default function AdminCatalogPage() {
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
              Quản lý chi nhánh dùng chung toàn hệ thống
            </p>
          </div>
        </div>
      </div>

      <div className="admin-hub__body">
        <AdminBranchesPage embedded />
      </div>
    </div>
  );
}
