export const dynamic = 'force-dynamic'

import { db, withDatabaseFallback } from '@/lib/db'
import { formatGuamDate } from '@/lib/datetime'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { LATEST_ARCHIVE_YEAR, archiveMediaForYear } from '@/lib/historical-archive'
import Link from 'next/link'

type GalleryItem = {
  id: string
  source: string
  title: string
  imageUrl: string
  articleUrl?: string | null
  caption?: string | null
  tags?: string | null
  takenAt?: Date | string | null
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ tournamentId?: string; source?: string; year?: string }>
}) {
  const params = await searchParams
  const tournamentId = params.tournamentId ?? undefined
  const sourceFilter = params.source ?? null
  const parsedYear = params.year ? Number(params.year) : null
  const yearFilter = parsedYear && Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 2200
    ? parsedYear
    : null

  const tournament = tournamentId
    ? await withDatabaseFallback(() => db.tournament.findUnique({ where: { id: tournamentId } }), null)
    : yearFilter
      ? await withDatabaseFallback(() => db.tournament.findFirst({ where: { year: yearFilter } }), null)
      : await getActiveTournament()

  const displayYear = yearFilter ?? tournament?.year ?? LATEST_ARCHIVE_YEAR
  const where = tournament ? { tournamentId: tournament.id } : undefined

  const dbItems = where
    ? await withDatabaseFallback(() => db.mediaAsset.findMany({
        where,
        orderBy: [{ takenAt: 'desc' }, { createdAt: 'desc' }],
        take: 300,
      }), [])
    : []

  const staticItems: GalleryItem[] = displayYear
    ? archiveMediaForYear(displayYear).map((item) => ({
        id: `archive:${item.imageUrl}`,
        source: item.source,
        title: item.title,
        imageUrl: item.imageUrl,
        articleUrl: item.articleUrl,
        caption: item.caption,
        tags: item.tags,
        takenAt: item.takenAt,
      }))
    : []

  const seenImages = new Set<string>()
  const allItems = [...dbItems, ...staticItems].filter((item) => {
    if (seenImages.has(item.imageUrl)) return false
    seenImages.add(item.imageUrl)
    return true
  })
  const items = allItems
    .filter((item) => !sourceFilter || item.source === sourceFilter)
    .sort((a, b) => new Date(b.takenAt ?? 0).getTime() - new Date(a.takenAt ?? 0).getTime())
  const featured = items.filter((item) => item.tags?.includes('featured')).slice(0, 3)

  const sources = Array.from(new Set(allItems.map((item) => item.source))).sort()

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>Gallery</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
          {tournament ? `${tournament.name} ${tournament.year}` : displayYear ? `FD Alumni Basketball Tournament ${displayYear}` : 'Tournament photos and media will appear here when available.'}
        </p>
        {sources.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Link href={`/gallery${tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : displayYear ? `?year=${displayYear}` : ''}`} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={!sourceFilter ? { background: 'var(--fd-ink)', color: '#fff' } : { background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--border-subtle)' }}>
              All sources
            </Link>
            {sources.map((s) => {
              const p = new URLSearchParams()
              if (tournamentId) p.set('tournamentId', tournamentId)
              else if (displayYear) p.set('year', String(displayYear))
              p.set('source', s)
              return (
                <Link key={s} href={`/gallery?${p.toString()}`} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={sourceFilter===s ? { background: 'var(--fd-maroon)', color: '#fff' } : { background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--border-subtle)' }}>
                  {s}
                </Link>
              )
            })}
          </div>
        ) : null}
      </div>

      {featured.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-600)' }}>Featured</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {featured.map((item) => (
              <article key={`featured-${item.id}`} className="rounded-xl border bg-white p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.title} className="h-44 w-full rounded-md object-cover" />
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{item.source}</p>
                <p className="mt-1 font-medium leading-snug">{item.title}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-sm text-neutral-600" style={{ borderColor: 'var(--border-subtle)' }}>
          No public media has been published for this tournament yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border bg-white p-3" style={{ borderColor: 'var(--border-subtle)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={item.title} className="h-48 w-full rounded-md object-cover" />
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{item.source}</p>
              <p className="mt-1 font-medium leading-snug">{item.title}</p>
              {item.caption ? <p className="mt-1 text-xs text-neutral-600 line-clamp-2">{item.caption}</p> : null}
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                <span>{item.takenAt ? formatGuamDate(item.takenAt) : 'No date'}</span>
                {item.articleUrl ? <a href={item.articleUrl} target="_blank" rel="noreferrer" className="underline">Source</a> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
