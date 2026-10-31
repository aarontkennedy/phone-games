import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the build works at any path (e.g. username.github.io/phone-games/).
  base: './',
  server: { host: true }, // reachable from your phone on the same Wi-Fi
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Phone Games',
        short_name: 'Games',
        description: 'Offline games. No ads, no accounts.',
        theme_color: '#15131f',
        background_color: '#15131f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache every game chunk so the whole app works offline after the first visit.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,txt}'], // txt: license notices on the About page
      },
    }),
  ],
});
