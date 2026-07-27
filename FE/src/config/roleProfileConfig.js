import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';

/**
 * Cau hinh ho so ca nhan theo tung role (view + edit URL rieng).
 * Admin dung AdminLayout; cac role con lai dung AppLayout + ProfilePageLayout.
 */
export const ROLE_PROFILE_CONFIG = Object.freeze({
  [ROLES.ADMIN]: {
    role: ROLES.ADMIN,
    label: 'Quản trị hệ thống',
    profilePath: ROUTES.ADMIN_PROFILE,
    profileEditPath: `${ROUTES.ADMIN_PROFILE}/edit`,
    notificationsPath: `${ROUTES.ADMIN_PROFILE}/notifications`,
    allowedRoles: [ROLES.ADMIN],
    useAdminLayout: true,
  },
  [ROLES.GENERAL_DIRECTOR]: {
    role: ROLES.GENERAL_DIRECTOR,
    label: 'Giám đốc',
    profilePath: ROUTES.DIRECTOR_PROFILE,
    profileEditPath: `${ROUTES.DIRECTOR_PROFILE}/edit`,
    allowedRoles: [ROLES.GENERAL_DIRECTOR, ROLES.ADMIN],
    useAdminLayout: false,
  },
  [ROLES.MANAGER]: {
    role: ROLES.MANAGER,
    label: 'Quản lý chi nhánh',
    profilePath: ROUTES.MANAGER_PROFILE,
    profileEditPath: `${ROUTES.MANAGER_PROFILE}/edit`,
    allowedRoles: [ROLES.MANAGER, ROLES.ADMIN],
    useAdminLayout: false,
  },
  [ROLES.SERVICE_ADVISOR]: {
    role: ROLES.SERVICE_ADVISOR,
    label: 'Cố vấn dịch vụ',
    profilePath: ROUTES.DASHBOARD_PROFILE,
    profileEditPath: `${ROUTES.DASHBOARD_PROFILE}/edit`,
    allowedRoles: [ROLES.SERVICE_ADVISOR, ROLES.ADMIN],
    useAdminLayout: false,
  },
  [ROLES.TEAM_LEADER]: {
    role: ROLES.TEAM_LEADER,
    label: 'Tổ trưởng kỹ thuật',
    profilePath: ROUTES.REPAIR_ORDERS_PROFILE,
    profileEditPath: `${ROUTES.REPAIR_ORDERS_PROFILE}/edit`,
    allowedRoles: [ROLES.TEAM_LEADER, ROLES.ADMIN],
    useAdminLayout: false,
  },
  [ROLES.TECHNICIAN]: {
    role: ROLES.TECHNICIAN,
    label: 'Kỹ thuật viên',
    profilePath: ROUTES.TECHNICIAN_PROFILE,
    profileEditPath: `${ROUTES.TECHNICIAN_PROFILE}/edit`,
    allowedRoles: [ROLES.TECHNICIAN, ROLES.ADMIN],
    useAdminLayout: false,
  },
  [ROLES.WAREHOUSE_STAFF]: {
    role: ROLES.WAREHOUSE_STAFF,
    label: 'Nhân viên kho',
    profilePath: ROUTES.INVENTORY_PROFILE,
    profileEditPath: `${ROUTES.INVENTORY_PROFILE}/edit`,
    allowedRoles: [ROLES.WAREHOUSE_STAFF, ROLES.ADMIN],
    useAdminLayout: false,
  },
});

/** Cac route profile dung AppLayout (khong gom admin). */
export const APP_PROFILE_ROUTE_CONFIGS = Object.freeze(
  Object.values(ROLE_PROFILE_CONFIG)
    .filter((cfg) => !cfg.useAdminLayout)
    .map(({ profilePath, allowedRoles }) => ({ profilePath, allowedRoles })),
);

export function getProfileConfigByRole(role) {
  return ROLE_PROFILE_CONFIG[role] || null;
}
