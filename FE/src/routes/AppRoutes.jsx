import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleAwareRedirect from '../components/RoleAwareRedirect';
import SessionExpiredModal from '../components/SessionExpiredModal';
import AppLayout from '../components/layout/AppLayout';
import AdminLayout from '../components/layout/AdminLayout';
import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';
import { ToastProvider } from '../components/common/ToastContext';
import { SharedDataProvider } from '../contexts/SharedDataContext';

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
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
const AdminRolesPage = lazy(() => import('../pages/admin/AdminRolesPage'));
const AdminDevicesPage = lazy(() => import('../pages/admin/AdminDevicesPage'));
const AdminSpecialtiesPage = lazy(() => import('../pages/admin/AdminSpecialtiesPage'));
const AdminPermissionMatrixPage = lazy(() => import('../pages/admin/AdminPermissionMatrixPage'));
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

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      Đang tải...
    </div>
  );
}

function AppRoutes() {
  return (
    <ToastProvider>
      <SharedDataProvider>
        <SessionExpiredModal />
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
          <Route path="branches" element={<AdminBranchesPage />} />
          <Route path="roles" element={<AdminRolesPage />} />
          <Route path="devices" element={<AdminDevicesPage />} />
          <Route path="specialties" element={<AdminSpecialtiesPage />} />
          <Route path="permission-matrix" element={<AdminPermissionMatrixPage />} />
          <Route path="logs" element={<AuditLogsPage />} />
          <Route path="login-sessions" element={<LoginSessionsPage />} />
          <Route path="profile" element={<AdminProfilePage />} />
          <Route path="profile/notifications" element={<AdminProfileNotificationsPage />} />
        </Route>
        {/* General Director settlement reports */}
                <Route
                  path="/general-director/*"
                  element={
                    <ProtectedRoute roles={[ROLES.GENERAL_DIRECTOR, ROLES.ADMIN]}>
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

        {/* Khách hàng - danh sách khách hàng, lịch sử dịch vụ, hợp đồng mua xe */}
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
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
            <ProtectedRoute>
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
  </ToastProvider>
  );
}

export default AppRoutes;
