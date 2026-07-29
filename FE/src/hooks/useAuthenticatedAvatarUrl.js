import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';

/**
 * Load avatar qua API co JWT, tra ve blob URL.
 * Giu anh cu khi fetch loi / remount (React Strict Mode) de tranh avatar bien mat.
 */
export function useAuthenticatedAvatarUrl(avatarFilename, cacheBuster = 0) {
  const [url, setUrl] = useState(null);
  const blobRef = useRef(null);
  const avatarFilenameRef = useRef(avatarFilename);

  useEffect(() => {
    avatarFilenameRef.current = avatarFilename;
  }, [avatarFilename]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!avatarFilename) {
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
          blobRef.current = null;
        }
        setUrl(null);
        return;
      }

      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE_URL}/profile/me/avatar?ts=${cacheBuster}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) return;

        const blob = await res.blob();
        const nextUrl = URL.createObjectURL(blob);

        if (cancelled || avatarFilenameRef.current !== avatarFilename) {
          URL.revokeObjectURL(nextUrl);
          return;
        }

        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
        }
        blobRef.current = nextUrl;
        setUrl(nextUrl);
      } catch {
        // Giu url hien tai neu fetch that bai (upload vua xong, reload tam thoi...)
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [avatarFilename, cacheBuster]);

  return url;
}
