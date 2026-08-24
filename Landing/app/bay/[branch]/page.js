import BayGrid from "./BayGrid";

export const metadata = {
  title: "Khoang xe - Chọn khoang",
  description: "Chọn khoang xe để mở màn hình nhận việc.",
  robots: { index: false, follow: false },
};

export default async function KhoangBranchPage({ params }) {
  const { branch } = await params;
  return <BayGrid slug={branch} />;
}
