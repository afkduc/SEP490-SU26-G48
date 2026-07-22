import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider, PermissionProvider } from './contexts';
import { ToastProvider } from './components/common/ToastContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* ToastProvider phai O NGOAI AppProvider vi PermissionEventsRunner
          (render boi AppProvider) se goi useToast() de hien toast refresh. */}
      <ToastProvider>
        <AppProvider>
          <PermissionProvider>
            <App />
          </PermissionProvider>
        </AppProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
