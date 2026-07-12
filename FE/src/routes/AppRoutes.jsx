import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleAwareRedirect from '../components/RoleAwareRedirect';
import AppLayout from '../components/layout/AppLayout';
import AdminLayout from '../components/layout/AdminLayout';
import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const RepairSettlementPage = lazy(() => import('../pages/repairsettlement/RepairSettlementPage'));
const RepairOrderPage = lazy(() => import('../pages/repairorder/RepairOrderPage'));
const UnauthorizedPage = lazy(() => import('../pages/errors/UnauthorizedPage'));
const GeneralDirectorPage = lazy(() => import('../pages/generalDirector/GeneralDirectorPage'));
const ManagerPage = lazy(() => import('../pages/manager/ManagerPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'));
const AdminRolesPage = lazy(() => import('../pages/admin/AdminRolesPage'));
const AuditLogsPage = lazy(() => import('../pages/admin/AuditLogsPage'));
const AdminProfilePage = lazy(() => import('../pages/admin/AdminProfilePage'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage'));
const InventoryLayout = lazy(() => import('../pages/inventory/InventoryLayout'));
const InventoryDashboardPage = lazy(() => import('../pages/inventory/DashboardPage'));
const SupplierListPage = lazy(() => import('../pages/inventory/SupplierListPage'));
const SupplierDetailPage = lazy(() => import('../pages/inventory/SupplierDetailPage'));
const PartListPage = lazy(() => import('../pages/inventory/PartListPage'));
const PartDetailPage = lazy(() => import('../pages/inventory/PartDetailPage'));
const StockPage = lazy(() => import('../pages/inventory/StockPage'));

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
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

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
              <AdminLayout>
                <AdminDashboardPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminLayout>
                <AdminUsersPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminLayout>
                <AdminRolesPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminLayout>
                <AuditLogsPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs/login"
          element={<Navigate to="/admin/logs?tab=login" replace />}
        />
        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminLayout>
                <AdminProfilePage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        {/* General Director settlement reports */}
                <Route
                  path="/general-director/*"
                  element={
                    <ProtectedRoute roles={[ROLES.GENERAL_DIRECTOR, ROLES.ADMIN]}>
                      <AppLayout>
                        <GeneralDirectorPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />

        {/* Quản lý chi nhánh - Nhân viên / Thợ máy / Tổ trưởng */}
        <Route
          path="/manager/*"
          element={
            <ProtectedRoute roles={[ROLES.MANAGER, ROLES.ADMIN]}>
              <AppLayout>
                <ManagerPage />
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

        {/* Lệnh sửa chữa */}
        <Route
          path="/repair-orders/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <RepairOrderPage />
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
          <Route path="parts" element={<PartListPage />} />
          <Route path="parts/:id" element={<PartDetailPage />} />
          <Route path="stock" element={<StockPage />} />
        </Route>

        {/* Placeholder routes */}
        {['/maintenance', '/customer-care', '/customers', '/services'].map((path) => (
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
        <Route path="/" element={<RoleAwareRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
