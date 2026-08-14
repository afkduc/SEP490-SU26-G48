import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { adminLoginSessionsApi } from '../../services/adminApi';
import { LoginSessionDetailContent } from './LoginSessionDetailView';
import './LoginSessionDetailPage.css';

export default function LoginSessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(location.state?.session || null);
  const [loading, setLoading] = useState(!location.state?.session);
  const [error, setError] = useState('');

  const backTo = `/admin/login-security${location.state?.fromListSearch || '?tab=sessions'}`;

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await adminLoginSessionsApi.list({
          sessionId: id,
          page: 1,
          pageSize: 1,
        });
        const item = Array.isArray(data?.items) ? data.items[0] : null;
        if (!cancelled) {
          if (item) setSession(item);
          else setError('Không tìm thấy phiên đăng nhập');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được chi tiết phiên');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleOpenDevices() {
    if (!session) return;
    const qs = new URLSearchParams();
    qs.set('tab', 'devices');
    if (session.user_id != null) qs.set('userId', String(session.user_id));
    if (session.user_name) qs.set('search', session.user_name);
    if (session.ip_address) qs.set('ip', session.ip_address);
    navigate(`/admin/login-security?${qs.toString()}`);
  }

  return (
    <div className="admin-page session-detail-page">
      <div className="admin-page__header">
        <div className="admin-page__title-block">
          <button
            type="button"
            className="session-detail-page__back"
            onClick={() => navigate(backTo)}
          >
            ← Quay lại lịch sử đăng nhập
          </button>
          <div className="admin-page__title-group">
            <h1>Chi tiết phiên đăng nhập</h1>
            <p className="admin-page__subtitle">Bản ghi #{id}</p>
          </div>
        </div>
      </div>

      <div className="session-detail-page__card">
        {loading && <div className="session-detail-page__state">Đang tải...</div>}
        {error && !loading && (
          <div className="session-detail-page__state session-detail-page__state--error">
            {error}
            <div style={{ marginTop: 12 }}>
              <Link to={backTo} className="btn btn--ghost">
                Về lịch sử
              </Link>
            </div>
          </div>
        )}
        {!loading && !error && session && (
          <LoginSessionDetailContent session={session} onOpenDevicesToProcess={handleOpenDevices} />
        )}
      </div>
    </div>
  );
}
