import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleAwareRedirect from '../components/RoleAwareRedirect';
import ProfileRedirect from '../components/ProfileRedirect';
import SessionExpiredModal from '../components/SessionExpiredModal';
import SessionTakenOverPrompt from '../components/SessionTakenOverPrompt';
import ForbiddenModal from '../components/ForbiddenModal';
import AppLayout from '../components/layout/AppLayout';
import AdminLayout from '../components/layout/AdminLayout';
import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';
import { APP_PROFILE_ROUTE_CONFIGS } from '../config/roleProfileConfig';
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
const AuditLogsPage = lazy(() => import('../pages/admin/AuditLogsPage'));
const AdminCatalogPage = lazy(() => import('../pages/admin/AdminCatalogPage'));
const AdminLoginSecurityPage = lazy(() => import('../pages/admin/AdminLoginSecurityPage'));
const AdminAccountPage = lazy(() => import('../pages/admin/AdminAccountPage'));
const AdminProfilePage = lazy(() => import('../pages/admin/AdminProfilePage'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage'));
/** Legacy alias — chi nhánh đã redirect sang /admin/catalog; giữ import để tránh HMR ReferenceError */
const AdminBranchesPage = lazy(() => import('../pages/admin/AdminBranchesPage'));
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

function ProfilePageLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function AppRoutes() {
  return (
    <>
      <SharedDataProvider>
        <SessionExpiredModal />
        <SessionTakenOverPrompt />
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
              roles={[
                ROLES.SERVICE_ADVISOR,
                ROLES.MANAGER,
                ROLES.GENERAL_DIRECTOR,
                ROLES.TEAM_LEADER,
                ROLES.TECHNICIAN,
                ROLES.ADMIN,
              ]}
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
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="roles" element={<Navigate to="/admin/users?tab=roles" replace />} />
          <Route path="catalog" element={<AdminCatalogPage />} />
          <Route path="branches" element={<Navigate to="/admin/catalog" replace />} />
          <Route path="specialties" element={<Navigate to="/admin/catalog?tab=specialties" replace />} />
          <Route path="vehicle-brands" element={<Navigate to="/admin/catalog?tab=brands" replace />} />
          <Route path="login-security" element={<AdminLoginSecurityPage />} />
          <Route path="security-alerts" element={<Navigate to="/admin/login-security?alerts=1" replace />} />
          <Route path="login-sessions" element={<Navigate to="/admin/login-security?tab=sessions" replace />} />
          <Route path="devices" element={<Navigate to="/admin/login-security" replace />} />
          <Route path="logs" element={<AuditLogsPage />} />
          <Route path="profile" element={<AdminAccountPage />} />
          <Route path="profile/edit" element={<AdminAccountPage />} />
          <Route path="profile/notifications" element={<Navigate to="/admin/profile?tab=notifications" replace />} />
        </Route>

        {/* Hồ sơ cá nhân — URL view/edit riêng cho từng role (AppLayout) */}
        {APP_PROFILE_ROUTE_CONFIGS.map(({ profilePath, allowedRoles }) => (
          <Route
            key={profilePath}
            path={profilePath}
            element={
              <ProtectedRoute roles={allowedRoles}>
                <ProfilePageLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminProfilePage />} />
            <Route path="edit" element={<AdminProfilePage />} />
          </Route>
        ))}

        {/* Legacy /profile, /profile/edit → redirect theo role */}
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute>
              <ProfileRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfileRedirect />
            </ProtectedRoute>
          }
        />

        {/* General Director */}
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

        {/* Quản lý chi nhánh */}
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
            <ProtectedRoute roles={[ROLES.SERVICE_ADVISOR, ROLES.MANAGER, ROLES.ADMIN]}>
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
            <ProtectedRoute roles={[ROLES.SERVICE_ADVISOR, ROLES.TEAM_LEADER, ROLES.TECHNICIAN, ROLES.MANAGER, ROLES.ADMIN]}>
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

        {/* Inventory module */}
        <Route
          path={ROUTES.INVENTORY}
          element={
            <ProtectedRoute
              roles={[ROLES.WAREHOUSE_STAFF]}
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
