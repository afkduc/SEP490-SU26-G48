import { useAuth } from '../contexts/AppContext';
import { usePermission } from '../contexts/PermissionContext';
import { useNavigate } from 'react-router-dom';
import './AccountantDashboardPage.css';

const ACCOUNTANT_NAV = [
  { label: 'Tổng quan kho', path: '/inventory', permission: 'screen:accountant:access' },
  { label: 'Phụ tùng', path: '/inventory/parts', permission: 'screen:accountant:access' },
  { label: 'Tồn kho', path: '/inventory/stock', permission: 'screen:accountant:access' },
  { label: 'Phiếu nhập', path: '/inventory/import-requests', permission: 'screen:accountant:access' },
  { label: 'Phiếu xuất', path: '/inventory/export-requests', permission: 'screen:accountant:access' },
  { label: 'Nhà cung cấp', path: '/inventory/suppliers', permission: 'screen:accountant:access' },
];

const QUICK_STATS = [
  { key: 'imports', label: 'Tổng phiếu nhập', icon: '📥', path: '/inventory/import-requests', description: 'Theo dõi các phiếu nhập kho đã được tạo' },
  { key: 'exports', label: 'Tổng phiếu xuất', icon: '📤', path: '/inventory/export-requests', description: 'Theo dõi các phiếu xuất kho đã được tạo' },
  { key: 'parts', label: 'Phụ tùng trong kho', icon: '🔧', path: '/inventory/parts', description: 'Danh sách phụ tùng hiện có trong hệ thống' },
  { key: 'stock', label: 'Tồn kho', icon: '📦', path: '/inventory/stock', description: 'Báo cáo tồn kho theo chi nhánh' },
  { key: 'suppliers', label: 'Nhà cung cấp', icon: '🏢', path: '/inventory/suppliers', description: 'Danh sách nhà cung cấp đang hợp tác' },
];

export default function AccountantDashboardPage() {
  const { user } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  return (
    <div className="accountant-dashboard">
      <header className="accountant-dashboard__header">
        <div>
          <h1 className="accountant-dashboard__title">Bảng điều khiển Kế toán</h1>
          <p className="accountant-dashboard__subtitle">
            Chào {user?.lastName || user?.name || 'bạn'}! Truy cập nhanh các báo cáo tài chính và quản lý kho.
          </p>
        </div>
      </header>

      <section className="accountant-dashboard__quick">
        <h2 className="accountant-dashboard__section-title">Truy cập nhanh</h2>
        <div className="accountant-dashboard__grid">
          {QUICK_STATS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="accountant-dashboard__card"
              onClick={() => navigate(item.path)}
            >
              <span className="accountant-dashboard__card-icon">{item.icon}</span>
              <span className="accountant-dashboard__card-label">{item.label}</span>
              <span className="accountant-dashboard__card-desc">{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="accountant-dashboard__info">
        <h2 className="accountant-dashboard__section-title">Phạm vi quyền của Kế toán</h2>
        <div className="accountant-dashboard__permission-list">
          {ACCOUNTANT_NAV.filter((item) => can(item.permission)).map((item) => (
            <span key={item.path} className="accountant-dashboard__chip">
              {item.label}
            </span>
          ))}
        </div>
        <p className="accountant-dashboard__note">
          Bạn chỉ có quyền xem các báo cáo tổng quan. Để thực hiện thao tác tạo/sửa/xóa, vui lòng liên hệ Quản lý chi nhánh hoặc Quản trị hệ thống.
        </p>
      </section>
    </div>
  );
}
