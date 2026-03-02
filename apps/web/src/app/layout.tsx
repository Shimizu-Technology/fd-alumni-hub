import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Sora } from 'next/font/google'
import './globals.css'
import '@/lib/tokens.css'
import { SiteHeader } from '@/components/site-header'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })

export const metadata: Metadata = {
  title: 'FD Alumni Basketball Hub',
  description: 'Schedule, standings, watch links, and updates for the FD Alumni Tournament.',
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${sora.variable}`}>
      <body style={{ background: 'var(--bg-page)', color: 'var(--neutral-900)' }}>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
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
