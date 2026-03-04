import Link from 'next/link'

const links = [
  ['/admin', 'Overview'],
  ['/admin/games', 'Games'],
  ['/admin/links', '🔗 Bulk Links'],
  ['/admin/missing-links', '⚠️ Missing Links'],
  ['/admin/divisions', 'Divisions'],
  ['/admin/standings', 'Standings'],
  ['/admin/news', 'News'],
  ['/admin/media', 'Media'],
  ['/admin/ingest', 'Ingestion Queue'],
  ['/admin/sponsors', 'Sponsors'],
]

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="rounded-lg border bg-white px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
