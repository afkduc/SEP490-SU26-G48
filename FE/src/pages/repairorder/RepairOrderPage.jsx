import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { ROLES } from '../../constants/roles';
import TeamLeaderDashboard from './TeamLeaderDashboard';

// To truong (dang nhap chinh tai khoan cua ho) thay man kiosk cu bang bang
// tin viec cho nhan realtime - xem TeamLeaderDashboard.jsx. Cac role khac
// (neu con link/bookmark cu tro toi day) redirect ve Phieu quyet toan.
export default function RepairOrderPage() {
  const { user } = useAuth();
  const isTeamLeader = user?.primaryRole === ROLES.TEAM_LEADER;

  return (
    <Routes>
      <Route
        index
        element={isTeamLeader ? <TeamLeaderDashboard /> : <Navigate to="/repair-settlement" replace />}
      />
      <Route path="*" element={<Navigate to="/repair-orders" replace />} />
    </Routes>
  );
}
