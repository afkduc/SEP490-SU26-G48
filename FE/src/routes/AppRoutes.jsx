import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import { ROLES } from '../constants/roles';

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const RepairSettlementPage = lazy(() => import('../pages/repairsettlement/RepairSettlementPage'));
const GeneralDirectorPage = lazy(() => import('../pages/generalDirector/GeneralDirectorPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage'));

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      Đang tải...
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected – wrapped in AppLayout (Navbar) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin – chỉ role admin */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AppLayout>
                <AdminDashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Phiếu quyết toán sửa chữa – Cố vấn dịch vụ */}
        <Route
          path="/repair-settlement/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <RepairSettlementPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Placeholder routes – thêm page thật sau */}
        {['/repair-orders', '/maintenance', '/customer-care', '/customers', '/services'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute>
                <AppLayout>
                  <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
                    Trang đang phát triển...
                  </div>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        ))}

        <Route
                  path="/general-director"
                  element={
                    <ProtectedRoute roles={['general_director']}>
                      <AppLayout>
                        <GeneralDirectorPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
        
                <Route
                  path="/general-director/*"
                  element={
                    <ProtectedRoute roles={['general_director']}>
                      <AppLayout>
                        <GeneralDirectorPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
        
                {/* Placeholder routes – thêm page thật sau */}
                {['/repair-settlement', '/maintenance', '/customer-care', '/customers', '/services'].map((path) => (
                  <Route
                    key={path}
                    path={path}
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
                            Trang đang phát triển...
                          </div>
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                ))}

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    
    
  );
}

export default AppRoutes;
export { LoginPage, DashboardPage, NotFoundPage };
