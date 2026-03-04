export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getHomeFeed } from '@/lib/services/public-feed'

export const metadata: Metadata = {
  title: 'News',
}

type NewsItem = {
  id: string
  source: string
  title: string
  publishedAt: Date | null
  url: string
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M2 10L10 2M10 2H6M10 2V6" />
    </svg>
  )
}

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const date = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <article
      className="group animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Link
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-3 rounded-xl border bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:flex-row sm:items-start sm:justify-between sm:gap-6"
        style={{
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="min-w-0 flex-1">
          {/* Source pill */}
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
            style={{ background: 'var(--fd-maroon)', color: '#fff' }}
          >
            {item.source}
          </span>

          {/* Title */}
          <h2
            className="font-semibold leading-snug text-base transition-colors group-hover:underline"
            style={{ color: 'var(--fd-ink)', textDecorationColor: 'var(--fd-maroon)' }}
          >
            {item.title}
          </h2>

          {/* Date */}
          {date && (
            <p className="mt-2 text-xs" style={{ color: 'var(--neutral-400)' }}>
              {date}
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-center">
          <span
            className="text-xs font-semibold whitespace-nowrap"
            style={{ color: 'var(--fd-maroon)' }}
          >
            Read
          </span>
          <span
            className="opacity-60 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--fd-maroon)' }}
          >
            <ExternalLinkIcon />
          </span>
        </div>
      </Link>
    </article>
  )
}

export default async function NewsPage() {
  const { tournament, latestNews } = await getHomeFeed()

  return (
    <section className="space-y-5">

      {/* Page header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>
          News
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
          {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
        </p>
      </div>

      {latestNews.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-10 text-center animate-fade-up delay-75"
          style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
            No news links yet. Add article links in Admin / News.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(latestNews as NewsItem[]).map((item, i) => (
            <NewsCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}
    </section>
  )
}
