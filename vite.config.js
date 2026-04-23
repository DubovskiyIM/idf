import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// SPA fallback middleware: /lifequest, /reflect и т.д. → index.html
function spaFallback() {
  const SPA_ROUTES = [
    '/lifequest', '/reflect', '/invest', '/sales',
    '/booking', '/booking-v2', '/planning', '/planning-v2',
    '/workflow', '/messenger', '/messenger-v2',
    '/freelance', '/gravitino',
  ];
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (SPA_ROUTES.some(r => url === r || url?.startsWith(r + '/'))) {
          req.url = '/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), basicSsl(), tailwindcss(), spaFallback()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: (process.env.PROXY_TARGET || 'http://localhost:3001').replace(/^http/, 'ws'),
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        studio: resolve(__dirname, 'studio.html'),
      },
    },
  },
  appType: 'mpa',
});
