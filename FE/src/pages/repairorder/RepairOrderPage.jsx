import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { ROLES } from '../../constants/roles';
import TeamLeaderKiosk from './TeamLeaderKiosk';

// To truong dung man hinh kiosk rieng (chon khoang xe -> nhan/lam viec) thay
// cho man "Cong viec cua toi" + man CVDV "Phan cong" thu cong cu - xem
// TeamLeaderKiosk.jsx. Cac role khac khong con man nao o day nua (CVDV theo
// doi tien do qua cac tab cua Phieu quyet toan sua chua).
export default function RepairOrderPage() {
  const { user } = useAuth();
  if (user?.primaryRole === ROLES.TEAM_LEADER) {
    return <TeamLeaderKiosk />;
  }
  return (
    <Routes>
      <Route index element={<Navigate to="/repair-settlement" replace />} />
      <Route path="*" element={<Navigate to="/repair-settlement" replace />} />
    </Routes>
  );
}
