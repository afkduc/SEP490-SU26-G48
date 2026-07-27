function toUserDto(user, roles, permissionKeys = []) {
  return {
    id: user.id,
    pseudoId: user.pseudo_id,
    name: user.user_name,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    branchId: user.branch_id,
    avatar: user.avatar,
    roles: roles.map((r) => r.role_name),
    roleLabels: roles.map((r) => r.role_label),
    primaryRole: roles[0]?.role_name || null,
    primaryRoleLabel: roles[0]?.role_label || null,
    permissions: permissionKeys,
    mustChangePassword: Boolean(user.must_change_password),
    tokenVersion: user.token_version || 1,
  };
}

module.exports = { toUserDto };
