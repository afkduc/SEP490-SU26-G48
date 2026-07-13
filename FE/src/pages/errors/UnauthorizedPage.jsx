import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common';
import './UnauthorizedPage.css';
import { useAuth } from '../../contexts/AppContext';
import { getRoleHome } from '../../contexts/AppContext';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'Khong co quyen truy cap | SEP490-G48';
  }, []);

  const handleGoHome = () => {
    navigate(getRoleHome(user), { replace: true });
  };

  return (
    <div className="unauthorized-page">
      <div className="unauthorized-card">
        <div className="unauthorized-icon" aria-hidden="true">🚫</div>
        <h1 className="unauthorized-title">Khong co quyen truy cap</h1>
        <p className="unauthorized-desc">
          Ban khong co quyen truy cap vao trang nay. Vui long lien he quan tri vien
          neu ban cho rang day la sai sot.
        </p>
        <Button variant="primary" onClick={handleGoHome}>
          Ve trang chu
        </Button>
      </div>
    </div>
  );
}
