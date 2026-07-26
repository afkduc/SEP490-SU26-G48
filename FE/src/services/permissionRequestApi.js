import httpClient from './httpClient';

/**
 * PermissionRequestApi - Admin duyet/tu choi yeu cau cap quyen.
 *
 *   - listPending(): GET /api/admin/permission-requests
 *     tra ve: { items: [{requestId, userId, userEmail, userName, permissionKey, reason, page, createdAt}], total }
 *
 *   - approve(id): POST /api/admin/permission-requests/:id/approve
 *     tra ve: { requestId, userId, permissionKey, screenKey, newTokenVersion }
 *     BE tu: grant user_screen_permissions(override_type='grant'), bump token_version
 *
 *   - reject(id, reason?): POST /api/admin/permission-requests/:id/reject
 *     tra ve: { requestId, userId, permissionKey }
 *     BE khong thay doi quyen, chi mark request = read + notify user.
 */
class PermissionRequestApi {
  listPending() {
    return httpClient.get('/admin/permission-requests');
  }

  approve(id) {
    return httpClient.post(`/admin/permission-requests/${id}/approve`, {});
  }

  reject(id, reason = null) {
    return httpClient.post(`/admin/permission-requests/${id}/reject`, { reason });
  }
}

const permissionRequestApi = new PermissionRequestApi();
export default permissionRequestApi;
export { PermissionRequestApi };
