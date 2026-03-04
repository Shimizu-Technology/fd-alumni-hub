import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Sora } from 'next/font/google'
import './globals.css'
import { SiteHeader } from '@/components/site-header'
// Note: tokens are now inlined in globals.css
import { SiteFooter } from '@/components/site-footer'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap', weight: ['400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: {
    default: 'FD Alumni Basketball Hub',
    template: '%s — FD Alumni Hub',
  },
  description: 'The official hub for FD Alumni Basketball. Schedule, standings, watch links, and verified updates for the tournament.',
  openGraph: {
    title: 'FD Alumni Basketball Hub',
    description: 'Schedule, standings, watch links, and updates for the FD Alumni Tournament.',
    type: 'website',
  },
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${sora.variable}`}>
      <body>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 md:py-12 min-h-[calc(100vh-56px-180px)]">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!clerkKey) {
    return <AppShell>{children}</AppShell>
  }

  return (
    <ClerkProvider publishableKey={clerkKey}>
      <AppShell>{children}</AppShell>
    </ClerkProvider>
  )
}
