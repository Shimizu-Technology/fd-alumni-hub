export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { db, withDatabaseFallback } from '@/lib/db'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { LATEST_ARCHIVE_YEAR, archiveArticlesForYear } from '@/lib/historical-archive'
import { mergeArchiveArticles, type FeedArticle } from '@/lib/services/public-feed'
import { formatGuamDate } from '@/lib/datetime'

export const metadata: Metadata = {
  title: 'News',
}

type NewsItem = FeedArticle

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M2 10L10 2M10 2H6M10 2V6" />
    </svg>
  )
}

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const date = item.publishedAt
    ? formatGuamDate(item.publishedAt, {
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
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.title} className="h-20 w-full rounded-lg object-cover sm:h-24 sm:w-40" />
        ) : null}

        <div className="min-w-0 flex-1">
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
            style={{ background: 'var(--fd-maroon)', color: '#fff' }}
          >
            {item.source}
          </span>

          <h2
            className="font-semibold leading-snug text-base transition-colors group-hover:underline"
            style={{ color: 'var(--fd-ink)', textDecorationColor: 'var(--fd-maroon)' }}
          >
            {item.title}
          </h2>

          {item.excerpt ? (
            <p className="mt-1 text-xs line-clamp-2" style={{ color: 'var(--neutral-500)' }}>
              {item.excerpt}
            </p>
          ) : null}

          {date && (
            <p className="mt-2 text-xs" style={{ color: 'var(--neutral-400)' }}>
              {date}
            </p>
          )}
        </div>

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

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tournamentId?: string; source?: string; year?: string }>
}) {
  const params = await searchParams
  const tournamentId = params.tournamentId ?? undefined
  const sourceFilter = params.source ?? null
  const yearFilter = params.year ? Number(params.year) : null

  const tournament = tournamentId
    ? await withDatabaseFallback(() => db.tournament.findUnique({ where: { id: tournamentId } }), null)
    : yearFilter
      ? await withDatabaseFallback(() => db.tournament.findFirst({ where: { year: yearFilter } }), null)
      : await getActiveTournament()

  const displayYear = yearFilter ?? tournament?.year ?? LATEST_ARCHIVE_YEAR

  const dbNews = tournament
    ? await withDatabaseFallback(() => db.articleLink.findMany({
        where: { tournamentId: tournament.id },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 150,
      }), [])
    : []

  const mergedNews = displayYear ? mergeArchiveArticles(dbNews, displayYear) : dbNews
  const latestNews = sourceFilter
    ? mergedNews.filter((item) => item.source === sourceFilter)
    : mergedNews

  const sources = displayYear
    ? Array.from(new Set([
        ...dbNews.map((item) => item.source),
        ...archiveArticlesForYear(displayYear).map((item) => item.source),
      ])).sort()
    : []

  return (
    <section className="space-y-5">

      {/* Page header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>
          News
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
          {tournament ? `${tournament.name} ${tournament.year}` : displayYear ? `FD Alumni Basketball Tournament ${displayYear}` : 'Tournament coverage will appear here when available.'}
        </p>
        {sources.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Link href={`/news${tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : displayYear ? `?year=${displayYear}` : ''}`} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={!sourceFilter ? { background: 'var(--fd-ink)', color: '#fff' } : { background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--border-subtle)' }}>
              All sources
            </Link>
            {sources.map((s) => {
              const p = new URLSearchParams()
              if (tournamentId) p.set('tournamentId', tournamentId)
              else if (displayYear) p.set('year', String(displayYear))
              p.set('source', s)
              return (
                <Link key={s} href={`/news?${p.toString()}`} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={sourceFilter===s ? { background: 'var(--fd-maroon)', color: '#fff' } : { background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--border-subtle)' }}>
                  {s}
                </Link>
              )
            })}
          </div>
        ) : null}
      </div>

      {latestNews.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-10 text-center animate-fade-up delay-75"
          style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
            No coverage links are published for this filter yet. Check back for GSPN, Clutch, and tournament updates.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {latestNews.map((item: NewsItem, i) => (
            <NewsCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}
    </section>
  )
}
