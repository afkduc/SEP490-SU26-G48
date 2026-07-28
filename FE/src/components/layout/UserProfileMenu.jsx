import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAuth,
  getPrimaryRole,
  getRoleProfilePath,
} from '../../contexts/AppContext';
import { ROLE_LABELS } from '../../constants/roles';
import { getProfileConfigByRole } from '../../config/roleProfileConfig';
import { useAuthenticatedAvatarUrl } from '../../hooks/useAuthenticatedAvatarUrl';
import './UserProfileMenu.css';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function IconUser({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLogout({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconChevron({ size = 14 }) {
  return (
    <svg className="user-profile-menu__caret" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function AvatarBubble({ name, imageUrl, className }) {
  const initials = getInitials(name);
  if (imageUrl) {
    return (
      <div className={className}>
        <img src={imageUrl} alt="" className="user-profile-menu__avatar-img" />
      </div>
    );
  }
  return <div className={className}>{initials}</div>;
}

/**
 * Menu hồ sơ + logout dùng chung cho 7 role (giống dropdown admin).
 */
export default function UserProfileMenu({
  showOnline = true,
  standalone = false,
  compact = false,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const role = getPrimaryRole(user);
  const roleConfig = getProfileConfigByRole(role);
  const roleLabel =
    user?.primaryRoleLabel
    || roleConfig?.label
    || ROLE_LABELS[role]
    || role
    || '';

  const profilePath = getRoleProfilePath(user);
  const displayName = user?.name || user?.userName || '—';
  const avatarUrl = useAuthenticatedAvatarUrl(user?.avatar);

  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function closeAndNavigate(path) {
    setOpen(false);
    navigate(path);
  }

  async function handleLogout() {
    setOpen(false);
    await logout();
  }

  if (!user) return null;

  return (
    <div
      ref={rootRef}
      className={`user-profile-menu${standalone ? ' user-profile-menu--standalone' : ''}`}
    >
      {showOnline && (
        <div className="user-profile-menu__online" title="Tài khoản đang hoạt động">
          <span className="user-profile-menu__online-dot" />
          <span className="user-profile-menu__online-label">Trực tuyến</span>
        </div>
      )}

      <div
        className="user-profile-menu__trigger"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <AvatarBubble
          name={displayName}
          imageUrl={avatarUrl}
          className="user-profile-menu__avatar"
        />
        {!compact && (
          <div className="user-profile-menu__info">
            <span className="user-profile-menu__name">{displayName}</span>
            <span className="user-profile-menu__role">{roleLabel}</span>
          </div>
        )}
        <IconChevron />
      </div>

      {open && (
        <div className="user-profile-menu__dropdown" role="menu">
          <div className="user-profile-menu__dropdown-header">
            <AvatarBubble
              name={displayName}
              imageUrl={avatarUrl}
              className="user-profile-menu__dropdown-avatar"
            />
            <div>
              <div className="user-profile-menu__dropdown-name">{displayName}</div>
              <div className="user-profile-menu__dropdown-email">{user.email || '—'}</div>
            </div>
          </div>

          <div className="user-profile-menu__divider" />

          <button
            type="button"
            className="user-profile-menu__item"
            role="menuitem"
            onClick={() => closeAndNavigate(profilePath)}
          >
            <IconUser />
            Hồ sơ cá nhân
          </button>

          <button
            type="button"
            className="user-profile-menu__item user-profile-menu__item--danger"
            role="menuitem"
            onClick={handleLogout}
          >
            <IconLogout />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
