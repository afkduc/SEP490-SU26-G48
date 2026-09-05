import BranchChooser from "./BranchChooser";

export const metadata = {
  title: "Màn hình bảo vệ - Chọn chi nhánh",
  description: "Chọn chi nhánh để mở màn hình bảo vệ theo dõi xe ra cổng.",
  robots: { index: false, follow: false },
};

// Trang chi de CHON dung link chi nhanh 1 lan roi bookmark lai - man hinh
// hoat dong that su nam o /security/[branch] (vd /security/hanoi), xem
// BranchGateScreen.jsx trong thu muc do.
export default function LandingPageForSecurity() {
  return <BranchChooser />;
}
