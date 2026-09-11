// PHẢI import trước react-router — patch History API trước khi Router giữ reference.
import './crmHistoryBootstrap';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider, PermissionProvider } from './contexts';
import { ToastProvider } from './components/common/ToastContext';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import { GlobalErrorProvider } from './contexts/GlobalErrorContext';
import { BASE_PATH } from './config';
import { CrmUrlGuard } from './utils/crmUrl';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={BASE_PATH}>
      <CrmUrlGuard />
      {/* ToastProvider phai O NGOAI AppProvider vi PermissionEventsRunner
          (render boi AppProvider) se goi useToast() de hien toast refresh. */}
      <ToastProvider>
        {/* Hop thoai xac nhan dung chung - thay window.confirm/prompt.
            Dat NGOAI AppProvider giong ToastProvider de moi man hinh,
            ke ca cac man render truoc khi co user, deu goi duoc. */}
        <ConfirmProvider>
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
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
