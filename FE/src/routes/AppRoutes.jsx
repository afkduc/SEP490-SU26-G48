import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const RepairSettlementPage = lazy(() => import('../pages/repairsettlement/RepairSettlementPage'));
const GeneralDirectorPage = lazy(() => import('../pages/generalDirector/GeneralDirectorPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage'));
const InventoryLayout = lazy(() => import('../pages/inventory/InventoryLayout'));
const InventoryDashboardPage = lazy(() => import('../pages/inventory/DashboardPage'));
const SupplierListPage = lazy(() => import('../pages/inventory/SupplierListPage'));
const SupplierDetailPage = lazy(() => import('../pages/inventory/SupplierDetailPage'));

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

        {/* Admin */}
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

        {/* Giám đốc */}
        <Route
          path="/general-director/*"
          element={
            <ProtectedRoute roles={[ROLES.GENERAL_DIRECTOR]}>
              <AppLayout>
                <GeneralDirectorPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Phiếu quyết toán sửa chữa */}
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

        {/* Inventory module */}
        <Route
          path={ROUTES.INVENTORY}
          element={
            <ProtectedRoute roles={[ROLES.WAREHOUSE_STAFF, ROLES.MANAGER, ROLES.GENERAL_DIRECTOR, ROLES.ACCOUNTANT, ROLES.ADMIN]}>
              <AppLayout>
                <InventoryLayout />
              </AppLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<InventoryDashboardPage />} />
          <Route path="suppliers" element={<SupplierListPage />} />
          <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        </Route>

        {/* Placeholder routes */}
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

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
export { LoginPage, DashboardPage, NotFoundPage };
