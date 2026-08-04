import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Landing chiem GOC domain (autogara.site truc tiep, khong con "/gioi-thieu"
  // nua) - CRM (FE React) chuyen sang "/crm", man bao ve la "/bao-ve/<chi
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
};

export default nextConfig;
