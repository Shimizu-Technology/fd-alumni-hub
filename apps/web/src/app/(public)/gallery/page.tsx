export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import Link from 'next/link'

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ tournamentId?: string; source?: string }>
}) {
  const params = await searchParams
  const tournamentId = params.tournamentId ?? undefined
  const sourceFilter = params.source ?? null

  const tournament = tournamentId
    ? await db.tournament.findUnique({ where: { id: tournamentId } })
    : await getActiveTournament()

  const items = await db.mediaAsset.findMany({
    where: tournament
      ? {
          tournamentId: tournament.id,
          ...(sourceFilter ? { source: sourceFilter } : {}),
        }
      : undefined,
    orderBy: [{ takenAt: 'desc' }, { createdAt: 'desc' }],
    take: 300,
  })

  const sourceRows = tournament
    ? await db.mediaAsset.findMany({ where: { tournamentId: tournament.id }, select: { source: true }, distinct: ['source'], orderBy: { source: 'asc' } })
    : []
  const sources = sourceRows.map(s => s.source)

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>Gallery</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
          {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
        </p>
        {sources.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Link href={`/gallery${tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : ''}`} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={!sourceFilter ? { background: 'var(--fd-ink)', color: '#fff' } : { background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--border-subtle)' }}>
              All sources
            </Link>
            {sources.map((s) => {
              const p = new URLSearchParams()
              if (tournamentId) p.set('tournamentId', tournamentId)
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

      {items.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-sm text-neutral-600" style={{ borderColor: 'var(--border-subtle)' }}>
          No media uploaded yet for this tournament.
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
                <span>{item.takenAt ? new Date(item.takenAt).toLocaleDateString('en-US') : 'No date'}</span>
                {item.articleUrl ? <a href={item.articleUrl} target="_blank" rel="noreferrer" className="underline">Source</a> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
