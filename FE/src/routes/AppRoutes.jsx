import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleAwareRedirect from '../components/RoleAwareRedirect';
import SessionExpiredModal from '../components/SessionExpiredModal';
import ForbiddenModal from '../components/ForbiddenModal';
import AppLayout from '../components/layout/AppLayout';
import AdminLayout from '../components/layout/AdminLayout';
import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';
import { SharedDataProvider } from '../contexts/SharedDataContext';
import { useGlobalError } from '../contexts/GlobalErrorContext';

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const RepairSettlementPage = lazy(() => import('../pages/repairsettlement/RepairSettlementPage'));
const RepairOrderPage = lazy(() => import('../pages/repairorder/RepairOrderPage'));
const CustomerHistoryPage = lazy(() => import('../pages/customer/CustomerHistoryPage'));
const CustomerCarePage = lazy(() => import('../pages/customercare/CustomerCarePage'));
const ServiceRequestsPage = lazy(() => import('../pages/servicerequests/ServiceRequestsPage'));
const UnauthorizedPage = lazy(() => import('../pages/errors/UnauthorizedPage'));
const GeneralDirectorPage = lazy(() => import('../pages/generalDirector/GeneralDirectorPage'));
const ManagerPage = lazy(() => import('../pages/manager/ManagerPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'));
const AdminBranchesPage = lazy(() => import('../pages/admin/AdminBranchesPage'));
const AuditLogsPage = lazy(() => import('../pages/admin/AuditLogsPage'));
const AdminDevicesPage = lazy(() => import('../pages/admin/AdminDevicesPage'));
const AdminSpecialtiesPage = lazy(() => import('../pages/admin/AdminSpecialtiesPage'));
const AdminPermissionMatrixPage = lazy(() => import('../pages/admin/AdminPermissionMatrixPage'));
const RoleScreenMatrixPage = lazy(() => import('../pages/admin/RoleScreenMatrixPage'));
const PermissionRequestsPage = lazy(() => import('../pages/admin/PermissionRequestsPage'));
const AdminProfilePage = lazy(() => import('../pages/admin/AdminProfilePage'));
const LoginSessionsPage = lazy(() => import('../pages/admin/AdminLoginSessionsPage'));
const AdminProfileNotificationsPage = lazy(() => import('../pages/admin/AdminProfileNotificationsPage'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage'));
const InventoryLayout = lazy(() => import('../pages/inventory/InventoryLayout'));
const InventoryDashboardPage = lazy(() => import('../pages/inventory/DashboardPage'));
const SupplierListPage = lazy(() => import('../pages/inventory/SupplierListPage'));
const SupplierDetailPage = lazy(() => import('../pages/inventory/SupplierDetailPage'));
const PartListPage = lazy(() => import('../pages/inventory/PartListPage'));
const PartDetailPage = lazy(() => import('../pages/inventory/PartDetailPage'));
const StockPage = lazy(() => import('../pages/inventory/StockPage'));
const ImportRequestListPage = lazy(() => import('../pages/inventory/ImportRequestListPage'));
const ImportRequestFormPage = lazy(() => import('../pages/inventory/ImportRequestFormPage'));
const ImportRequestDetailPage = lazy(() => import('../pages/inventory/ImportRequestDetailPage'));
const ExportRequestListPage = lazy(() => import('../pages/inventory/ExportRequestListPage'));
const ExportRequestFormPage = lazy(() => import('../pages/inventory/ExportRequestFormPage'));
const ExportRequestDetailPage = lazy(() => import('../pages/inventory/ExportRequestDetailPage'));

/**
 * ErrorHandler — bắt lỗi 403 toàn cục từ error event.
 * Khi component con throw error với status=403, component này
 * sẽ hiển thị UnauthorizedPage.
 */
function ErrorHandler() {
  const { globalError, clearError } = useGlobalError();

  useEffect(() => {
    if (!globalError) return;

    const handlePopState = () => {
      if (window.location.pathname !== '/unauthorized') {
        clearError();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [globalError, clearError]);

  // Auto-clear globalError khi user dang o trang /login.
  // Ly do: khi token stale va user click "Dang nhap lai" tu SessionExpiredModal,
  // navigate('/login') se fire. AppContext clear token, nhung globalError van
  // con giu set403Error tu ProtectedRoute truoc do -> ErrorHandler van show
  // UnauthorizedPage full-screen, che form login. Clear o day de form login
  // render binh thuong.
  useEffect(() => {
    if (!globalError) return;
    if (window.location.pathname === '/login') {
      clearError();
    }
  }, [globalError, clearError]);

  if (!globalError) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: '#f9fafb',
      overflow: 'auto',
    }}>
      <UnauthorizedPage
        permissionKey={globalError.permissionKey}
        customMessage={globalError.message}
      />
    </div>
  );
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      Đang tải...
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <SharedDataProvider>
        <SessionExpiredModal />
        <ForbiddenModal />
        <ErrorHandler />
        <Suspense fallback={<Loading />}>
          <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Protected – wrapped in AppLayout (Navbar) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              permissions={[
                'screen:dashboard:access',
                'screen:advisor:dashboard:access',
                'screen:manager:dashboard:access',
                'screen:director:dashboard:access',
                'screen:leader:dashboard:access',
              ]}
              match="any"
            >
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminLayout>
                <Outlet />
              </AdminLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="users" element={
            <ProtectedRoute roles={[ROLES.ADMIN]} permission="admin:users:read">
              <AdminUsersPage />
            </ProtectedRoute>
          } />
          <Route path="branches" element={
            <ProtectedRoute roles={[ROLES.ADMIN]} permission="screen:branches:access">
              <AdminBranchesPage />
            </ProtectedRoute>
          } />
          <Route path="roles" element={<Navigate to="/admin/users?tab=roles" replace />} />
          <Route path="devices" element={
            <ProtectedRoute roles={[ROLES.ADMIN]} permission="screen:devices:access">
              <AdminDevicesPage />
            </ProtectedRoute>
          } />
          <Route path="specialties" element={
            <ProtectedRoute roles={[ROLES.ADMIN]} permission="screen:specialties:access">
              <AdminSpecialtiesPage />
            </ProtectedRoute>
          } />
          <Route path="permission-matrix" element={
            <ProtectedRoute roles={[ROLES.ADMIN]} permission="screen:permission_matrix:access">
              <AdminPermissionMatrixPage />
            </ProtectedRoute>
          } />
          <Route path="permission-requests" element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <PermissionRequestsPage />
            </ProtectedRoute>
          } />
          <Route path="role-screen-matrix" element={
            <ProtectedRoute roles={[ROLES.ADMIN]} permission="screen:role_screen_matrix:access">
              <RoleScreenMatrixPage />
            </ProtectedRoute>
          } />
          <Route path="logs" element={
            <ProtectedRoute roles={[ROLES.ADMIN]} permission="screen:audit_logs:access">
              <AuditLogsPage />
            </ProtectedRoute>
          } />
          <Route path="login-sessions" element={
            <ProtectedRoute roles={[ROLES.ADMIN]} permission="screen:login_sessions:access">
              <LoginSessionsPage />
            </ProtectedRoute>
          } />
          <Route path="profile" element={<AdminProfilePage />} />
          <Route path="profile/notifications" element={<AdminProfileNotificationsPage />} />
        </Route>
        {/* General Director – any submodule access key grants entry */}
                <Route
                  path="/general-director/*"
                  element={
                    <ProtectedRoute
                      roles={[ROLES.GENERAL_DIRECTOR, ROLES.ADMIN]}
                      permissions={[
                        'screen:director:dashboard:access',
                        'screen:director:reports:access',
                        'screen:director:settlements:access',
                        'screen:director:employees:access',
                        'screen:director:technicians:access',
                        'screen:director:branches:access',
                        'screen:director:branch_managers:access',
                      ]}
                      match="any"
                    >
                      <AppLayout showNavbar={false}>
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

        {/* Hồ sơ cá nhân — mọi role đã đăng nhập */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AppLayout>
                <AdminProfilePage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Phiếu quyết toán sửa chữa — shared + advisor matrix keys */}
        <Route
          path="/repair-settlement/*"
          element={
            <ProtectedRoute
              permissions={[
                'screen:repair-settlement:access',
                'screen:advisor:orders:access',
              ]}
              match="any"
            >
              <AppLayout>
                <RepairSettlementPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Lệnh sửa chữa — shared + advisor/leader matrix keys */}
        <Route
          path="/repair-orders/*"
          element={
            <ProtectedRoute
              permissions={[
                'screen:repair-orders:access',
                'screen:advisor:orders:access',
                'screen:leader:orders:access',
                'screen:leader:tasks:access',
              ]}
              match="any"
            >
              <AppLayout>
                <RepairOrderPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Khách hàng - danh sách khách hàng, lịch sử dịch vụ, hợp đồng mua xe */}
        <Route
          path="/customers"
          element={
            <ProtectedRoute roles={[ROLES.SERVICE_ADVISOR, ROLES.MANAGER, ROLES.ADMIN]}>
              <AppLayout>
                <CustomerHistoryPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Yeu cau tu van tu landing page - CVDV tiep nhan + tao lich hen */}
        <Route
          path="/service-requests"
          element={
            <ProtectedRoute roles={[ROLES.SERVICE_ADVISOR, ROLES.ADMIN]}>
              <AppLayout>
                <ServiceRequestsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Chăm sóc khách hàng - nhắc nhở bảo dưỡng */}
        <Route
          path="/customer-care"
          element={
            <ProtectedRoute roles={[ROLES.SERVICE_ADVISOR, ROLES.MANAGER, ROLES.ADMIN]}>
              <AppLayout>
                <CustomerCarePage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Inventory module — top-level inventory + submodule / manager keys */}
        <Route
          path={ROUTES.INVENTORY}
          element={
            <ProtectedRoute
              roles={[ROLES.WAREHOUSE_STAFF, ROLES.MANAGER, ROLES.GENERAL_DIRECTOR, ROLES.ADMIN]}
              permissions={[
                'screen:inventory:access',
                'screen:manager:inventory:access',
                'screen:inventory:products:access',
                'screen:inventory:stock:access',
                'screen:inventory:suppliers:access',
                'screen:inventory:import-requests:access',
                'screen:inventory:export-requests:access',
                'screen:inventory:low-stock:access',
                'screen:warehouse:products:access',
                'screen:warehouse:stock:access',
              ]}
              match="any"
            >
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
          <Route path="import-requests" element={<ImportRequestListPage />} />
          <Route path="import-requests/new" element={<ImportRequestFormPage />} />
          <Route path="import-requests/:id" element={<ImportRequestDetailPage />} />
          <Route path="export-requests" element={<ExportRequestListPage />} />
          <Route path="export-requests/new" element={<ExportRequestFormPage />} />
          <Route path="export-requests/:id" element={<ExportRequestDetailPage />} />
        </Route>

        {/* Placeholder routes */}
        {['/maintenance', '/services'].map((path) => (
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
    </SharedDataProvider>
    </>
  );
}

export default AppRoutes;
