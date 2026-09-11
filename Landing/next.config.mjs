import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** CRM roots — nếu F5 vào URL thiếu /crm (host nginx đưa về Landing) thì 307 sang /crm/... */
const CRM_REDIRECT_ROOTS = [
  'admin',
  'login',
  'unauthorized',
  'manager',
  'inventory',
  'repair',
  'technician',
  'customer',
  'profile',
  'team-leader',
  'warehouse',
  'cashier',
  'receptionist',
  'general-director',
  'repair-settlement',
];

/** Route cu (ten tieng Viet) -> route moi (ten tieng Anh). Xem redirects(). */
const RENAMED_VI_ROUTES = {
  'bao-ve': 'security',
  'khoang': 'bay',
  'kinh-nghiem': 'blog',
  'tra-cuu': 'lookup',
  'goi-dich-vu': 'service-packages',
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Landing chiem GOC domain (autogara.site truc tiep, khong con "/gioi-thieu"
  // nua) - CRM (FE React) chuyen sang "/crm", man bao ve la "/security/<chi
  // nhanh>" - ca 2 deu la route CUA CHINH Landing nay, khong can basePath.
  // Xem FE/nginx.conf (location / proxy toi day) + FE/vite.config.js (base "/crm/").
  // Repo cha co ca BE/FE/Landing, moi thu muc co package-lock.json rieng ->
  // Next tu suy doan workspace root bi nham thanh thu muc goc repo (chua ca
  // BE/FE), khien Turbopack quet/resolve module tren ca cay thu muc khong
  // lien quan - co the treo dev server. Chi ro root la chinh Landing/ de
  // tranh nham lan nay.
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      ...CRM_REDIRECT_ROOTS.flatMap((root) => [
        {
          source: `/${root}`,
          destination: `/crm/${root}`,
          permanent: false,
        },
        {
          source: `/${root}/:path*`,
          destination: `/crm/${root}/:path*`,
          permanent: false,
        },
      ]),
      // Cac route truoc day dat ten tieng Viet, da doi sang tieng Anh. Chuyen
      // huong 301 tu duong dan CU vi chung da chay that:
      //  - /khoang/<chi nhanh>/<so khoang> dang mo san tren tablet o tung
      //    khoang xe trong xuong, /bao-ve/<chi nhanh> tren man hinh bao ve -
      //    khong redirect thi cac may do trang trang, phai di sua tay tung cai.
      //  - /kinh-nghiem/* la bai viet SEO da duoc Google lap chi muc, /tra-cuu
      //    nam trong sitemap.xml - doi thang se mat thu hang va gay link ngoai.
      // permanent: true (301) de Google chuyen han thu hang sang URL moi.
      ...Object.entries(RENAMED_VI_ROUTES).flatMap(([oldPath, newPath]) => [
        {
          source: `/${oldPath}`,
          destination: `/${newPath}`,
          permanent: true,
        },
        {
          source: `/${oldPath}/:path*`,
          destination: `/${newPath}/:path*`,
          permanent: true,
        },
      ]),
    ];
  },
};

export default nextConfig;
