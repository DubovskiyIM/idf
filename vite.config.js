import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import { resolve, join } from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';

// SPA fallback middleware: derives список из src/domains/* — single
// source of truth для регистрации доменов (§13.10).
function spaFallback() {
  const domainsDir = resolve(__dirname, 'src', 'domains');
  const DOMAIN_IDS = readdirSync(domainsDir).filter((d) => {
    try {
      return statSync(join(domainsDir, d)).isDirectory();
    } catch {
      return false;
    }
  });
  const V2_ALIASES = ['booking-v2', 'planning-v2', 'messenger-v2'];
  const SPA_ROUTES = [...DOMAIN_IDS, ...V2_ALIASES].map((d) => `/${d}`);
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

// basicSsl даёт self-signed HTTPS на :5173. Это ломает плоский HTTP
// доступ через ssh -R / reverse-proxy / curl без -k. Включается только
// по ENV VITE_HTTPS=1 — по умолчанию dev на чистом HTTP.
const ENABLE_SSL = process.env.VITE_HTTPS === "1";

export default defineConfig({
  plugins: [
    react(),
    ...(ENABLE_SSL ? [basicSsl()] : []),
    tailwindcss(),
    spaFallback(),
  ],
  server: {
    host: '0.0.0.0',
    // Vite v5+ блокирует чужие Host headers (DNS rebinding guard). Для
    // ssh -R / cloud tunnel доступа разрешаем все hosts — это dev only.
    allowedHosts: true,
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
