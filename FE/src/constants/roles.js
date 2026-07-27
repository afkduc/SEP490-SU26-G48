export const ROLES = Object.freeze({
  ADMIN: 'admin',
  GENERAL_DIRECTOR: 'general_director',
  MANAGER: 'manager',
  SERVICE_ADVISOR: 'service_advisor',
  WAREHOUSE_STAFF: 'warehouse_staff',
  TEAM_LEADER: 'team_leader',
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Quản trị hệ thống',
  [ROLES.GENERAL_DIRECTOR]: 'Giám đốc',
  [ROLES.MANAGER]: 'Quản lý chi nhánh',
  [ROLES.SERVICE_ADVISOR]: 'Cố vấn dịch vụ',
  [ROLES.WAREHOUSE_STAFF]: 'Nhân viên kho',
  [ROLES.TEAM_LEADER]: 'Tổ trưởng kỹ thuật',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));