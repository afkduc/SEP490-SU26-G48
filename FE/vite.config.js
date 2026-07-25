import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
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
          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy Error]', err.message);
          });
        },
      },
    },
  },
});
