import { useState, useEffect, useCallback } from 'react';
import { adminRolesApi } from '../../services/adminApi';

/**
 * Hook for UC-11: Admin Roles listing
 * @param {Object} options
 * @param {boolean} options.enabled - fetch immediately (default true)
 */
export function useAdminRoles({ enabled = true } = {}) {
  const [roles, setRoles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminRolesApi.list();
      const items = result?.items ?? result ?? [];
      setRoles(items);
      setTotal(Array.isArray(items) ? items.length : (result?.total ?? 0));
    } catch (err) {
      setError(err.message || 'Khong the tai danh sach role');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) fetch();
  }, [enabled, fetch]);

  return { roles, total, loading, error, refetch: fetch };
}

/**
 * Hook for UC-11: Role detail
 * @param {number|string} roleId
 */
export function useRoleDetail(roleId) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!roleId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminRolesApi.getDetail(roleId);
      setRole(data);
    } catch (err) {
      setError(err.message || 'Khong the tai chi tiet role');
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { role, loading, error, refetch: fetch };
}
