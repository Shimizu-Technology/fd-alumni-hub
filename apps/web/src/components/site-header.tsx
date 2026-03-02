import Link from 'next/link'

const links = [
  ['Schedule', '/schedule'],
  ['Standings', '/standings'],
  ['Watch', '/watch'],
  ['News', '/news'],
  ['Sponsors', '/sponsors'],
]

export function SiteHeader() {
  return (
    <header className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight" style={{ color: 'var(--fd-maroon)' }}>
          FD Alumni Hub
        </Link>
        <nav className="hidden gap-4 text-sm md:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="text-neutral-700 hover:opacity-80">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
