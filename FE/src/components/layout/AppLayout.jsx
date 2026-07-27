import Navbar from './Navbar';
import UserProfileMenu from './UserProfileMenu';
import { ServiceRequestsProvider } from '../../contexts/ServiceRequestsContext';
import './AppLayout.css';

export default function AppLayout({ children, showNavbar = true }) {
  return (
    <ServiceRequestsProvider>
      <div className="app-layout">
        {showNavbar ? <Navbar /> : <UserProfileMenu standalone showOnline />}
        <main className="app-layout__main">{children}</main>
      </div>
    </ServiceRequestsProvider>
  );
}
