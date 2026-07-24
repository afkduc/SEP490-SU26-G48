import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  metadataBase: new URL("https://autogara.vn"),
  title: {
    default: "AutoGara - Gara sửa chữa ô tô uy tín",
    template: "%s | AutoGara",
  },
  description:
    "AutoGara - gara sửa chữa, bảo dưỡng ô tô chuyên nghiệp. Tra cứu tiến độ sửa chữa xe của bạn trực tuyến bằng mã sửa chữa.",
  keywords: ["autogara", "gara oto", "sua chua o to", "bao duong o to", "tra cuu tien do sua xe"],
  openGraph: {
    title: "AutoGara - Gara sửa chữa ô tô uy tín",
    description:
      "Gara sửa chữa, bảo dưỡng ô tô chuyên nghiệp. Tra cứu tiến độ sửa chữa xe trực tuyến.",
    siteName: "AutoGara",
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body>{children}</body>
    </html>
  );
}
