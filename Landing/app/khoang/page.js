import BranchChooser from "./BranchChooser";

export const metadata = {
  title: "Khoang xe - Chọn chi nhánh",
  description: "Chọn chi nhánh để mở màn hình nhận việc theo khoang xe.",
  robots: { index: false, follow: false },
};

export default function KhoangIndexPage() {
  return <BranchChooser />;
}
