import type { Metadata } from 'next'
import './globals.css'
import '@/lib/tokens.css'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'FD Alumni Basketball Hub',
  description: 'Schedule, standings, watch links, and updates for the FD Alumni Tournament.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ background: 'var(--bg-page)', color: 'var(--neutral-900)' }}>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
