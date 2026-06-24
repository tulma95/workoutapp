import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tanstackRouter({ quoteStyle: 'single' }),
    react(),
    VitePWA({
      // Keep our custom service worker (push, notification, navigation) and let
      // the plugin inject the precache manifest into it (Workbox).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // SW is registered manually in main.tsx (PROD only) and the manifest is
      // already maintained in public/manifest.webmanifest.
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      // Match the previous behaviour: no service worker in dev.
      devOptions: { enabled: false },
    }),
  ],
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
