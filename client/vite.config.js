import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    /**
     * Proxy the API and the websocket to Express during development.
     *
     * WHY a proxy instead of an absolute http://localhost:5000 base URL: with
     * the proxy, the browser only ever talks to ONE origin (5173), so the
     * auth cookie behaves in development exactly as it will in production,
     * where Express serves this build itself. Without it we would need CORS
     * plus SameSite=None cookies in dev only - and a bug that appears in one
     * environment and not the other.
     */
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true, // required, or the websocket upgrade is dropped
        changeOrigin: true,
      },
    },
  },

  build: {
    // Express serves this folder in production (see server/app.js).
    outDir: 'dist',
    sourcemap: false,
  },
});
