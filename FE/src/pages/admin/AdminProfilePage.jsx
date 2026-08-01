import MyProfilePage from '../profile/MyProfilePage';

/** Hồ sơ — Quản trị hệ thống (dùng trong AdminAccountPage). */
export default function AdminProfilePage({ embedded = false } = {}) {
  return (
    <MyProfilePage
      embedded={embedded}
      title="Tài khoản quản trị"
      subtitle="Hồ sơ tài khoản quản trị hệ thống"
    />
  );
}
