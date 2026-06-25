import { useAuth } from '../../contexts/AppContext';
import './DashboardPage.css';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <div className="dashboard__welcome">
        <h1>Xin chào, {user?.name} 👋</h1>
        <p>
          Vai trò: <strong>{user?.roleLabels?.join(', ') || user?.roles?.join(', ')}</strong>
          {user?.branchId && <span> · Chi nhánh #{user?.branchId}</span>}
        </p>
      </div>

      <div className="dashboard__cards">
        <div className="dash-card">
          <div className="dash-card__icon">📋</div>
          <div>
            <p className="dash-card__label">Phiếu sửa chữa hôm nay</p>
            <p className="dash-card__value">--</p>
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card__icon">🔧</div>
          <div>
            <p className="dash-card__label">Đang sửa chữa</p>
            <p className="dash-card__value">--</p>
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card__icon">✅</div>
          <div>
            <p className="dash-card__label">Hoàn thành hôm nay</p>
            <p className="dash-card__value">--</p>
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card__icon">💰</div>
          <div>
            <p className="dash-card__label">Doanh thu tháng</p>
            <p className="dash-card__value">--</p>
          </div>
        </div>
      </div>
    </div>
  );
}
