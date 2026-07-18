import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider, PermissionProvider } from './contexts';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <PermissionProvider>
          <App />
        </PermissionProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
