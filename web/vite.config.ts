import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { siteUrlPlugin } from './config/siteUrl'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = env.VITE_SITE_URL || process.env.VITE_SITE_URL

  return {
    plugins: [react(), siteUrlPlugin(siteUrl)],
    server: {
      port: 5173,
    },
  }
})
