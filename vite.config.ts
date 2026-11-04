import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { moveApi } from './server/plugin.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The analytics API runs inside the dev server and reads its settings (ADMIN_PASSWORD, STATS_*) from .env.local.
  // They have no VITE_ prefix, so they are never sent to the browser.
  Object.assign(process.env, loadEnv(mode, '.', ''))
  return {
    plugins: [react(), tailwindcss(), moveApi()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5175,
      strictPort: true,
    },
  }
})
