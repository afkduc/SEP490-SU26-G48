import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminBranchesApi } from '../../../services/adminApi';
import { useToast } from '../../../components/common/ToastContext';
import { useApiError } from '../../../hooks/useApiError';
import PermissionGate from '../../../components/PermissionGate';
import '../AdminBranchesPage.css';
import './BranchPages.css';

function formatCurrency(value) {
  if (value == null) return '—';
  const num = Number(value);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} tỷ`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} triệu`;
  return num.toLocaleString('vi-VN');
}

export default function BranchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { handleApiError } = useApiError();
  const [branch, setBranch] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [detail, statsRes] = await Promise.all([
        adminBranchesApi.getDetail(id),
        adminBranchesApi.getStats(id).catch(() => null),
      ]);
      setBranch(detail);
      setStats(statsRes);
    } catch (err) {
      setError(err.message || 'Không tải được chi nhánh');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDeactivate() {
    if (!branch) return;
    if (!window.confirm(
      `Ngưng hoạt động chi nhánh "${branch.branchName}"? Nhân viên tại chi nhánh sẽ không thể đăng nhập. (Không xóa cứng.)`
    )) return;
    setActionLoading(true);
    try {
      await adminBranchesApi.deactivate(branch.id);
      toast.success('Đã ngưng hoạt động chi nhánh');
      await load();
    } catch (err) {
      if (!handleApiError(err, 'admin:branches:deactivate')) {
        toast.error(err.message || 'Lỗi khi ngưng hoạt động');
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    if (!branch) return;
    setActionLoading(true);
    try {
      await adminBranchesApi.reactivate(branch.id);
      toast.success('Đã kích hoạt lại chi nhánh');
      await load();
    } catch (err) {
      if (!handleApiError(err, 'admin:branches:update')) {
        toast.error(err.message || 'Lỗi khi kích hoạt');
      }
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="admin-page branch-page">
      <div className="admin-page__header">
        <div className="admin-page__title-block">
          <button type="button" className="branch-page__back" onClick={() => navigate('/admin/catalog')}>
            ← Quay lại danh mục
          </button>
          <div className="admin-page__title-group">
            <h1>Chi tiết chi nhánh</h1>
            <p className="admin-page__subtitle">Thông tin và thống kê nhanh của chi nhánh</p>
          </div>
        </div>
        {branch && (
          <div className="admin-page__actions">
            <PermissionGate permission="admin:branches:update">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate(`/admin/catalog/branches/${branch.id}/edit`)}
              >
                Sửa
              </button>
            </PermissionGate>
            {branch.isActive ? (
              <PermissionGate permission="admin:branches:deactivate">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleDeactivate}
                  disabled={actionLoading}
                >
                  Ngưng hoạt động
                </button>
              </PermissionGate>
            ) : (
              <PermissionGate permission="admin:branches:update">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleReactivate}
                  disabled={actionLoading}
                >
                  Kích hoạt lại
                </button>
              </PermissionGate>
            )}
          </div>
        )}
      </div>

      <div className="branch-page__card">
        {loading && <div className="branch-page__state">Đang tải...</div>}
        {error && !loading && (
          <div className="branch-page__state branch-page__state--error">
            {error}
            <div style={{ marginTop: 12 }}>
              <Link to="/admin/catalog" className="btn btn--ghost">Về danh mục</Link>
            </div>
          </div>
        )}
        {!loading && !error && branch && (
          <>
            <div className="branch-detail__head">
              <span className="branch-card__code">{branch.branchCode}</span>
              <h2 className="branch-detail__name">{branch.branchName}</h2>
              <span className={`branch-card__status-badge branch-card__status-badge--${branch.isActive ? 'active' : 'inactive'}`}>
                {branch.isActive ? 'Hoạt động' : 'Dừng hoạt động'}
              </span>
            </div>

            <dl className="branch-detail__list">
              <div><dt>Địa chỉ</dt><dd>{branch.address || '—'}</dd></div>
              <div><dt>Điện thoại</dt><dd>{branch.phone || '—'}</dd></div>
              <div>
                <dt>Email</dt>
                <dd>
                  {(() => {
                    const branchEmail = branch.email?.trim();
                    const managerEmail = branch.managerEmail?.trim();
                    if (branchEmail) return branchEmail;
                    if (managerEmail) return managerEmail;
                    return 'Chưa cập nhật';
                  })()}
                </dd>
              </div>
              <div><dt>Quản lý</dt><dd>{branch.managerName || 'Chưa có quản lý'}</dd></div>
            </dl>

            <h3 className="branch-detail__stats-title">Thống kê nhanh</h3>
            {stats ? (
              <>
                <div className="branch-detail__stats">
                  <div className="branch-stat-card">
                    <span className="branch-stat-card__value">{stats.userCount}</span>
                    <span className="branch-stat-card__label">Nhân viên</span>
                  </div>
                  <div className="branch-stat-card branch-stat-card--active">
                    <span className="branch-stat-card__value">{stats.orderCount}</span>
                    <span className="branch-stat-card__label">Đơn hàng</span>
                  </div>
                  <div className="branch-stat-card">
                    <span className="branch-stat-card__value">{formatCurrency(stats.revenue30Days)}</span>
                    <span className="branch-stat-card__label">Doanh thu 30 ngày</span>
                  </div>
                </div>
                <p className="form-hint">
                  * Doanh thu theo tổng đơn hoàn thành trong 30 ngày gần nhất (thông tin phụ — tổng quan Admin chính là IAM/bảo mật).
                </p>
              </>
            ) : (
              <p className="form-hint">Không tải được thống kê chi nhánh.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
