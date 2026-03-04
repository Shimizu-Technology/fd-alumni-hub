export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getHomeFeed } from '@/lib/services/public-feed'

export default async function NewsPage() {
  const { tournament, latestNews } = await getHomeFeed()

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>News</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
        </p>
      </div>

      <div className="space-y-3">
        {latestNews.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-neutral-600" style={{ borderColor: 'var(--border-subtle)' }}>
            No news links yet. Add article links in Admin / News.
          </div>
        ) : latestNews.map((item: { id: string; source: string; title: string; publishedAt: Date | null; url: string }) => (
          <article key={item.id} className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs uppercase tracking-wide text-neutral-500">{item.source}</p>
            <h2 className="mt-1 text-lg font-semibold">{item.title}</h2>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-neutral-500">{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US') : 'No date'}</p>
              <Link href={item.url} target="_blank" className="text-sm font-medium" style={{ color: 'var(--fd-maroon)' }}>Read</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
