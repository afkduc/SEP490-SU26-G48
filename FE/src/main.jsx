import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider, PermissionProvider } from './contexts';
import { ToastProvider } from './components/common/ToastContext';
import { GlobalErrorProvider } from './contexts/GlobalErrorContext';
import { BASE_PATH } from './config';
import { ensureCrmHistoryBase } from './utils/ensureCrmHistoryBase';
import './styles/index.css';

// Patch History API TRƯỚC khi mount Router — tránh mất prefix /crm trên production.
ensureCrmHistoryBase();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={BASE_PATH}>
      {/* ToastProvider phai O NGOAI AppProvider vi PermissionEventsRunner
          (render boi AppProvider) se goi useToast() de hien toast refresh. */}
      <ToastProvider>
        <AppProvider>
          {/* GlobalErrorProvider: dung cho ErrorHandler/AppRoutes show trang 403
              full-screen khi set403Error() duoc goi (vi du tu AdminUsersPage,
              useApiError hook). Phai boc PermissionProvider vi ca 2 cung dung
              useGlobalError. */}
          <GlobalErrorProvider>
            <PermissionProvider>
              <App />
            </PermissionProvider>
          </GlobalErrorProvider>
        </AppProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
