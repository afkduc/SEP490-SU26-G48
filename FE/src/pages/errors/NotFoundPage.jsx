import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common';
import { useAuth } from '../../contexts/AppContext';
import { getRoleHome } from '../../contexts/AppContext';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.title = '404 - Not Found | SEP490-G48';
  }, []);

  return (
    <div className="not-found">
      <h1>404</h1>
      <p>Trang ban tim khong ton tai.</p>
      <Button onClick={() => navigate(getRoleHome(user), { replace: true })}>
        Ve trang chu
      </Button>
    </div>
  );
}
