import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/gioi-thieu',
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
