import { useEffect, useRef, useState } from 'react';

/**
 * Load avatar qua API co JWT, tra ve blob URL an toan.
 * Quan ly revoke blob cu dung cach — tranh anh bien mat sau upload.
 */
export function useAuthenticatedAvatarUrl(avatarFilename, cacheBuster = 0) {
  const [url, setUrl] = useState(null);
  const blobRef = useRef(null);

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
      if (!token) {
        setUrl(null);
        return;
      }

      try {
        const res = await fetch(`/api/profile/me/avatar?ts=${cacheBuster}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setUrl(null);
          return;
        }
        const blob = await res.blob();
        const nextUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
        }
        blobRef.current = nextUrl;
        setUrl(nextUrl);
      } catch {
        if (!cancelled) setUrl(null);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [avatarFilename, cacheBuster]);

  useEffect(() => () => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
  }, []);

  return url;
}
