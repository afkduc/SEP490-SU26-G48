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
import { ROLES, INVENTORY_ACCESS_ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';
import { BASE_PATH } from '../config';
import { APP_PROFILE_ROUTE_CONFIGS } from '../config/roleProfileConfig';

const LOGIN_PATH = `${BASE_PATH}/login`;
const UNAUTHORIZED_PATH = `${BASE_PATH}/unauthorized`;
import { SharedDataProvider } from '../contexts/SharedDataContext';
import { useGlobalError } from '../contexts/GlobalErrorContext';
import { useAuth } from '../contexts/AppContext';

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const RepairSettlementPage = lazy(() => import('../pages/repairsettlement/RepairSettlementPage'));
const RepairOrderPage = lazy(() => import('../pages/repairorder/RepairOrderPage'));
const ActiveBaysPage = lazy(() => import('../pages/repairorder/ActiveBaysPage'));
const CustomerHistoryPage = lazy(() => import('../pages/customer/CustomerHistoryPage'));
const CustomerCarePage = lazy(() => import('../pages/customercare/CustomerCarePage'));
const ServiceRequestsPage = lazy(() => import('../pages/servicerequests/ServiceRequestsPage'));
const UnauthorizedPage = lazy(() => import('../pages/errors/UnauthorizedPage'));
const GeneralDirectorPage = lazy(() => import('../pages/generalDirector/GeneralDirectorPage'));
const ManagerPage = lazy(() => import('../pages/manager/ManagerPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'));
const UserFormPage = lazy(() => import('../pages/admin/users/UserFormPage'));
const UserDetailPage = lazy(() => import('../pages/admin/users/UserDetailPage'));
const AuditLogsPage = lazy(() => import('../pages/admin/AuditLogsPage'));
const AuditLogDetailPage = lazy(() => import('../pages/admin/AuditLogDetailPage'));
const AdminCatalogPage = lazy(() => import('../pages/admin/AdminCatalogPage'));
const BranchFormPage = lazy(() => import('../pages/admin/branches/BranchFormPage'));
const BranchDetailPage = lazy(() => import('../pages/admin/branches/BranchDetailPage'));
const AdminLoginSecurityPage = lazy(() =>
  import('../pages/admin/AdminLoginSecurityPage').then((m) => {
    if (!m?.default) {
      throw new Error('AdminLoginSecurityPage missing default export');
    }
    return { default: m.default };
  })
);
const AdminAccountPage = lazy(() => import('../pages/admin/AdminAccountPage'));
const DirectorProfilePage = lazy(() => import('../pages/generalDirector/DirectorProfilePage'));
const ManagerProfilePage = lazy(() => import('../pages/manager/ManagerProfilePage'));
const ServiceAdvisorProfilePage = lazy(() => import('../pages/dashboard/ServiceAdvisorProfilePage'));
const TeamLeaderProfilePage = lazy(() => import('../pages/repairorder/TeamLeaderProfilePage'));
const TechnicianProfilePage = lazy(() => import('../pages/technician/TechnicianProfilePage'));
const WarehouseProfilePage = lazy(() => import('../pages/inventory/WarehouseProfilePage'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage'));

const ROLE_PROFILE_PAGES = Object.freeze({
  director: DirectorProfilePage,
  manager: ManagerProfilePage,
  serviceAdvisor: ServiceAdvisorProfilePage,
  teamLeader: TeamLeaderProfilePage,
  technician: TechnicianProfilePage,
  warehouse: WarehouseProfilePage,
});
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
      if (window.location.pathname !== UNAUTHORIZED_PATH) {
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
    if (window.location.pathname === LOGIN_PATH) {
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
          <Route path="users/new" element={<UserFormPage mode="create" />} />
          <Route path="users/:id/edit" element={<UserFormPage mode="edit" />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="roles" element={<Navigate to="/admin/users" replace />} />
          <Route path="catalog" element={<AdminCatalogPage />} />
          <Route path="catalog/branches/new" element={<BranchFormPage mode="create" />} />
          <Route path="catalog/branches/:id/edit" element={<BranchFormPage mode="edit" />} />
          <Route path="catalog/branches/:id" element={<BranchDetailPage />} />
          <Route path="branches" element={<Navigate to="/admin/catalog" replace />} />
          <Route path="vehicle-brands" element={<Navigate to="/admin/catalog" replace />} />
          <Route path="login-security" element={<AdminLoginSecurityPage />} />
          <Route path="security-alerts" element={<Navigate to="/admin/login-security?alerts=1" replace />} />
          <Route path="login-sessions" element={<Navigate to="/admin/login-security?tab=sessions" replace />} />
          <Route path="devices" element={<Navigate to="/admin/login-security" replace />} />
          <Route path="logs" element={<AuditLogsPage />} />
          <Route path="logs/:id" element={<AuditLogDetailPage />} />
          <Route path="profile" element={<AdminAccountPage />} />
          <Route path="profile/edit" element={<AdminAccountPage />} />
          <Route path="profile/notifications" element={<Navigate to="/admin/profile?tab=notifications" replace />} />
        </Route>

        {/* Hồ sơ cá nhân — page riêng theo từng role (không dùng chung AdminProfile) */}
        {APP_PROFILE_ROUTE_CONFIGS.map(({ profilePath, allowedRoles, pageKey }) => {
          const ProfilePage = ROLE_PROFILE_PAGES[pageKey];
          if (!ProfilePage) return null;
          return (
            <Route
              key={profilePath}
              path={profilePath}
              element={
                <ProtectedRoute roles={allowedRoles}>
                  <ProfilePageLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ProfilePage />} />
              <Route path="edit" element={<ProfilePage />} />
            </Route>
          );
        })}

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

        {/* Lệnh sửa chữa - bảng tin nhận việc của tổ trưởng, xem RepairOrderPage.jsx */}
        <Route
          path="/repair-orders/*"
          element={
            <ProtectedRoute roles={[ROLES.SERVICE_ADVISOR, ROLES.TECHNICIAN, ROLES.MANAGER, ROLES.ADMIN, ROLES.TEAM_LEADER]}>
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

        {/* CVDV - xem khoang xe cua to truong nao dang hoat dong, dang lam xe gi */}
        <Route
          path="/active-bays"
          element={
            <ProtectedRoute roles={[ROLES.SERVICE_ADVISOR, ROLES.ADMIN]}>
              <AppLayout>
                <ActiveBaysPage />
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
            <ProtectedRoute roles={[...INVENTORY_ACCESS_ROLES]}>
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
          <Route
            path="import-requests/new"
            element={
              <ProtectedRoute permission="import_requests:create">
                <ImportRequestFormPage />
              </ProtectedRoute>
            }
          />
          <Route path="import-requests/:id" element={<ImportRequestDetailPage />} />
          <Route path="export-requests" element={<ExportRequestListPage />} />
          <Route
            path="export-requests/new"
            element={
              <ProtectedRoute permission="export_requests:create">
                <ExportRequestFormPage />
              </ProtectedRoute>
            }
          />
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
                  <div style={{ padding: 32, textAlign: 'center', color: '#71717a' }}>
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
