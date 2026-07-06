import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common';
import './UnauthorizedPage.css';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Không có quyền truy cập | SEP490-G48';
  }, []);

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  return (
    <div className="unauthorized-page">
      <div className="unauthorized-card">
        <div className="unauthorized-icon" aria-hidden="true">🚫</div>
        <h1 className="unauthorized-title">Không có quyền truy cập</h1>
        <p className="unauthorized-desc">
          Bạn không có quyền truy cập vào trang này. Vui lòng liên hệ quản trị viên
          nếu bạn cho rằng đây là sai sót.
        </p>
        <Button variant="primary" onClick={handleGoHome}>
          Về trang chủ
        </Button>
      </div>
    </div>
  );
}