import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // He thong quan ly noi bo dat duoi "/crm" tren domain that khi BUILD
  // production (Landing chiem goc domain, xem docker-compose.yml +
  // FE/nginx.conf) - phai khop voi BrowserRouter basename (main.jsx, xem
  // BASE_PATH trong src/config/index.js) va location /crm trong nginx.conf.
  // Giu nguyen "/" luc "npm run dev" de khong doi thoi quen chay local hien tai.
  base: command === 'build' ? '/crm/' : '/',
  server: {
    port: 3000,
    // HMR SU DUNG PORT rieng (khong di qua proxy) de tranh 431 Request Header
    // Fields Too Large. Mac dinh Vite dung cung port 3000 cho HMR nhung
    // neu co proxy rewrite, header se ton dong. Dat HMR qua WebSocket rieng.
    hmr: {
      port: 3001,
      clientPort: 3001,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // QUAN TRONG: Vite KHONG tu set X-Forwarded-For nhu nginx. Neu khong
        // set thu cong, BE se thay req.ip = '::1' (loopback) thay vi IP may
        // that → man login-sessions hien IP sai, login-history khong khop
        // voi thiet bi.
        // Fix: rewrite function set X-Forwarded-For tu socket.remoteAddress
        // (IP client that) truoc khi forward sang BE.
        // BE phai co app.set('trust proxy', true) de tin header nay.
        rewrite: (path) => path,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const clientIp = req.socket?.remoteAddress || '';
            if (clientIp) {
              // Khong ghi đè X-Forwarded-For neu upstream proxy đã set
              if (!proxyReq.getHeader('x-forwarded-for')) {
                proxyReq.setHeader('X-Forwarded-For', clientIp);
              }
              if (!proxyReq.getHeader('x-real-ip')) {
                proxyReq.setHeader('X-Real-IP', clientIp);
              }
            }
          });
          proxy.on('error', (err, req) => {
            // ECONNRESET tren cac endpoint SSE (/api/sse/*, ket noi mo lien
            // tuc de push thong bao realtime) la binh thuong: xay ra moi khi
            // trang reload (Vite HMR) hoac tab dong trong luc dang giu stream
            // mo - EventSource cua trinh duyet tu dong ket noi lai ngay sau
            // do, khong anh huong gi. Chi log do (nhu loi that su) cho cac
            // truong hop khac.
            const isBenignSseReset = err.code === 'ECONNRESET' && req.url?.startsWith('/api/sse/');
            if (!isBenignSseReset) {
              console.error('[Vite Proxy Error]', err.message);
            }
          });
        },
      },
    },
  },
}));
