import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AppContext';
import { getAdminDashboardStats } from '../../services/adminApi';
import { ROLES } from '../../constants/roles';
import './AdminDashboardPage.css';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdminDashboardStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không thể tải thống kê');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__header">
        <h1>🛡️ Trang quản trị</h1>
        <p>
          Xin chào <strong>{user.name}</strong> ({user.email}) — vai trò:{' '}
          <strong>Quản trị hệ thống</strong>
        </p>
      </header>

      {loading && <p className="admin-dashboard__info">Đang tải thống kê...</p>}
      {error && <p className="admin-dashboard__error">Lỗi: {error}</p>}

      {stats && (
        <>
          <section className="admin-dashboard__stats">
            <div className="admin-stat-card">
              <span className="admin-stat-card__icon">👥</span>
              <p className="admin-stat-card__label">Tổng người dùng</p>
              <p className="admin-stat-card__value">{stats.totalUsers}</p>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__icon">🏢</span>
              <p className="admin-stat-card__label">Tổng chi nhánh</p>
              <p className="admin-stat-card__value">{stats.totalBranches}</p>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__icon">🟢</span>
              <p className="admin-stat-card__label">Phiên hoạt động</p>
              <p className="admin-stat-card__value">{stats.activeSessions}</p>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__icon">⏰</span>
              <p className="admin-stat-card__label">Cập nhật lúc</p>
              <p className="admin-stat-card__value admin-stat-card__value--sm">
                {new Date(stats.generatedAt).toLocaleString('vi-VN')}
              </p>
            </div>
          </section>

          <section className="admin-dashboard__actions">
            <h2>Thao tác nhanh</h2>
            <div className="admin-action-grid">
              <button type="button" className="admin-action" disabled>
                👤 Quản lý người dùng
              </button>
              <button type="button" className="admin-action" disabled>
                🏢 Quản lý chi nhánh
              </button>
              <button type="button" className="admin-action" disabled>
                🔍 Xem nhật ký
              </button>
              <button type="button" className="admin-action" disabled>
                ⚙️ Cài đặt hệ thống
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}