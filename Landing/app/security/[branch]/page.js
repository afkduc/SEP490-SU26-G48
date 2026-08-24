import BranchGateScreen from "./BranchGateScreen";

export const metadata = {
  title: "Màn hình bảo vệ - Xe ra cổng",
  description:
    "Màn hình dành cho bảo vệ tại cổng, theo dõi xe khách đã thanh toán xong và sẵn sàng ra cổng.",
  robots: { index: false, follow: false },
};

// URL co dinh theo tung chi nhanh (vd /security/hanoi) - khong dang nhap, khong
// can chon lai chi nhanh moi lan mo (bookmark 1 lan la xong). Xem
// branchSlugs.js o thu muc cha cho danh sach slug hop le.
export default async function LandingPageForSecurityBranch({ params }) {
  const { branch } = await params;
  return <BranchGateScreen slug={branch} />;
}
