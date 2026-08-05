import { ROLES, INVENTORY_ACCESS_ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';

/**
 * Cấu hình hồ sơ cá nhân theo từng role (URL view/edit riêng + page riêng).
 * Admin dùng AdminLayout + AdminAccountPage; các role còn lại dùng AppLayout.
 */
export const ROLE_PROFILE_CONFIG = Object.freeze({
  [ROLES.ADMIN]: {
    role: ROLES.ADMIN,
    label: 'Quản trị hệ thống',
    profilePath: ROUTES.ADMIN_PROFILE,
    profileEditPath: `${ROUTES.ADMIN_PROFILE}/edit`,
    notificationsPath: `${ROUTES.ADMIN_PROFILE}?tab=notifications`,
    allowedRoles: [ROLES.ADMIN],
    useAdminLayout: true,
    pageKey: 'admin',
  },
  [ROLES.GENERAL_DIRECTOR]: {
    role: ROLES.GENERAL_DIRECTOR,
    label: 'Giám đốc',
    profilePath: ROUTES.DIRECTOR_PROFILE,
    profileEditPath: `${ROUTES.DIRECTOR_PROFILE}/edit`,
    allowedRoles: [ROLES.GENERAL_DIRECTOR, ROLES.ADMIN],
    useAdminLayout: false,
    pageKey: 'director',
  },
  [ROLES.MANAGER]: {
    role: ROLES.MANAGER,
    label: 'Quản lý chi nhánh',
    profilePath: ROUTES.MANAGER_PROFILE,
    profileEditPath: `${ROUTES.MANAGER_PROFILE}/edit`,
    allowedRoles: [ROLES.MANAGER, ROLES.ADMIN],
    useAdminLayout: false,
    pageKey: 'manager',
  },
  [ROLES.SERVICE_ADVISOR]: {
    role: ROLES.SERVICE_ADVISOR,
    label: 'Cố vấn dịch vụ',
    profilePath: ROUTES.DASHBOARD_PROFILE,
    profileEditPath: `${ROUTES.DASHBOARD_PROFILE}/edit`,
    allowedRoles: [ROLES.SERVICE_ADVISOR, ROLES.ADMIN],
    useAdminLayout: false,
    pageKey: 'serviceAdvisor',
  },
  [ROLES.TEAM_LEADER]: {
    role: ROLES.TEAM_LEADER,
    label: 'Tổ trưởng kỹ thuật',
    profilePath: ROUTES.REPAIR_ORDERS_PROFILE,
    profileEditPath: `${ROUTES.REPAIR_ORDERS_PROFILE}/edit`,
    allowedRoles: [ROLES.TEAM_LEADER, ROLES.ADMIN],
    useAdminLayout: false,
    pageKey: 'teamLeader',
  },
  [ROLES.TECHNICIAN]: {
    role: ROLES.TECHNICIAN,
    label: 'Kỹ thuật viên',
    profilePath: ROUTES.TECHNICIAN_PROFILE,
    profileEditPath: `${ROUTES.TECHNICIAN_PROFILE}/edit`,
    allowedRoles: [ROLES.TECHNICIAN, ROLES.ADMIN],
    useAdminLayout: false,
    pageKey: 'technician',
  },
  [ROLES.WAREHOUSE_STAFF]: {
    role: ROLES.WAREHOUSE_STAFF,
    label: 'Nhân viên kho',
    profilePath: ROUTES.INVENTORY_PROFILE,
    profileEditPath: `${ROUTES.INVENTORY_PROFILE}/edit`,
    allowedRoles: [...INVENTORY_ACCESS_ROLES],
    useAdminLayout: false,
    pageKey: 'warehouse',
  },
});

/** Các route profile dùng AppLayout (không gồm admin). */
export const APP_PROFILE_ROUTE_CONFIGS = Object.freeze(
  Object.values(ROLE_PROFILE_CONFIG)
    .filter((cfg) => !cfg.useAdminLayout)
    .map(({ profilePath, allowedRoles, pageKey }) => ({
      profilePath,
      allowedRoles,
      pageKey,
    })),
);

export function getProfileConfigByRole(role) {
  return ROLE_PROFILE_CONFIG[role] || null;
}
