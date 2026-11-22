import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { siteUrlPlugin } from './config/siteUrl'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = env.VITE_SITE_URL || process.env.VITE_SITE_URL
  const clerkKey = (env.VITE_CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim()

  if (mode === 'production' && clerkKey.startsWith('pk_test_')) {
    console.warn(
      '[fd-alumni-hub] WARNING: Production build configured with a Clerk test key (pk_test_...). ' +
      'Switch VITE_CLERK_PUBLISHABLE_KEY to a pk_live_ key before cutover (see docs/DOMAIN-AND-CLERK-SETUP.md).',
    )
  }

  return {
    plugins: [react(), siteUrlPlugin(siteUrl)],
    server: {
      port: 5173,
    },
  }
})
