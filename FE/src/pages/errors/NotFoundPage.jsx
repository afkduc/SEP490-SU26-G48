import { useEffect } from 'react';
import { Button } from '../../components/common';

export default function NotFoundPage() {
  useEffect(() => {
    document.title = '404 - Not Found | SEP490-G48';
  }, []);

  return (
    <div className="not-found">
      <h1>404</h1>
      <p>Trang bạn tìm không tồn tại.</p>
      <Button onClick={() => (window.location.href = '/')}>Về trang chủ</Button>
    </div>
  );
}
