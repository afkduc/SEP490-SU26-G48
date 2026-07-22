import Navbar from './Navbar';
import { ServiceRequestsProvider } from '../../contexts/ServiceRequestsContext';
import './AppLayout.css';

export default function AppLayout({ children }) {
  return (
    <ServiceRequestsProvider>
      <div className="app-layout">
        <Navbar />
        <main className="app-layout__main">{children}</main>
      </div>
    </ServiceRequestsProvider>
  );
}
