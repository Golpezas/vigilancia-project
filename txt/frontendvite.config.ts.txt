import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}']
  },
  manifest: {
    name: 'Control de Rondas - Vigilancia QR',
    short_name: 'Vigilancia QR',
    description: 'Sistema de control de rondas para vigiladores con QR y geolocalización',
    theme_color: '#1e40af',
    background_color: '#f3f4f6',
    display: 'standalone',
    scope: '/',
    start_url: '/',
    icons: [
      {
        src: 'android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: 'android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: 'android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ]
  }
})