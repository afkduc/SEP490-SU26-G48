import { useCallback } from 'react';
import { useGlobalError } from '../contexts/GlobalErrorContext';

/**
 * Hook để handle 403 errors một cách centralized.
 * Thay vì mỗi page tự catch và hiện alert/xử lý,
 * dùng hook này để dispatch global error -> hiện UnauthorizedPage đẹp.
 *
 * @example
 *   const { handleApiError } = useApiError();
 *
 *   try {
 *     await adminBranchesApi.create(payload);
 *   } catch (err) {
 *     handleApiError(err, 'admin:branches:create');
 *   }
 */
export function useApiError() {
  const { set403Error } = useGlobalError();

  const handleApiError = useCallback((error, permissionKey = null) => {
    if (error?.status === 403) {
      set403Error(
        permissionKey || error?.permissionKey,
        error.message || 'Bạn không có quyền thực hiện thao tác này'
      );
      return true; // đã handle
    }
    return false; // không phải 403
  }, [set403Error]);

  return { handleApiError };
}
