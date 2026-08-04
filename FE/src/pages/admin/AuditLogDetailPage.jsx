import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { auditApi } from '../../services/auditApi';
import { AuditLogDetailContent } from './AuditLogDetailView';
import './AuditLogsPage.css';
import './AuditLogDetailPage.css';

export default function AuditLogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const backTo = `/admin/logs${location.state?.fromListSearch || ''}`;

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await auditApi.getAuditLogById(id);
        if (!cancelled) setLog(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được chi tiết nhật ký');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="admin-page admin-logs audit-detail-page">
      <div className="admin-page__header">
        <div className="admin-page__title-block">
          <button type="button" className="audit-detail-page__back" onClick={() => navigate(backTo)}>
            ← Quay lại danh sách
          </button>
          <div className="admin-page__title-group">
            <h1>Chi tiết nhật ký</h1>
            <p className="admin-page__subtitle">Bản ghi #{id}</p>
          </div>
        </div>
      </div>

      <div className="audit-detail-page__card">
        {loading && <div className="audit-detail-page__state">Đang tải...</div>}
        {error && !loading && (
          <div className="audit-detail-page__state audit-detail-page__state--error">
            {error}
            <div style={{ marginTop: 12 }}>
              <Link to={backTo} className="btn btn--ghost">Về danh sách</Link>
            </div>
          </div>
        )}
        {!loading && !error && log && <AuditLogDetailContent log={log} />}
      </div>
    </div>
  );
}
