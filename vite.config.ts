import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { moveApi } from './server/plugin.mjs'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // The analytics API runs inside the dev server and reads its settings (ADMIN_PASSWORD, STATS_*) from .env.local.
  // They have no VITE_ prefix, so they are never sent to the browser.
  Object.assign(process.env, loadEnv(mode, '.', ''))
  return {
    // The live site puts the VCE portfolio at the root and Move under /anipanel/ (see src/lib/paths.ts and
    // scripts/add-vce.mjs). The dev server keeps Move at / so local Discord login works as before.
    base: command === 'build' ? '/anipanel/' : '/',
    build: { outDir: 'dist/anipanel', emptyOutDir: true },
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
