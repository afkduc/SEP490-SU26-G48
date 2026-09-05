import BayScreen from "./BayScreen";

export const metadata = {
  title: "Khoang xe - Nhận việc",
  description: "Màn hình nhận việc và làm việc cố định của 1 khoang xe, không đăng nhập.",
  robots: { index: false, follow: false },
};

// URL co dinh theo tung khoang (vd /bay/hanoi/13) - khong dang nhap, danh
// tinh (khoang nao, thuoc to truong nao) den tu chinh URL nay, khong phai tu
// session dang nhap nhu truoc.
export default async function KhoangBayPage({ params }) {
  const { branch, bayNumber } = await params;
  return <BayScreen slug={branch} bayNumber={bayNumber} />;
}
