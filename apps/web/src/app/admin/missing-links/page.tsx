import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function MissingLinksPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) {
    return (
      <section className="space-y-4">
        <AdminNav />
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
          No active tournament found.
        </div>
      </section>
    )
  }

  const games = await db.game.findMany({
    where: { tournamentId: tournament.id },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { startTime: 'asc' },
  })

  const total = games.length
  const missingTicket = games.filter(g => !g.ticketUrl)
  const missingStream = games.filter(g => !g.streamUrl)
  const missingBoth = games.filter(g => !g.ticketUrl && !g.streamUrl)
  const hasEither = games.filter(g => !g.ticketUrl || !g.streamUrl)

  const pct = (n: number) => total ? `${Math.round((n / total) * 100)}%` : '0%'

  return (
    <section className="space-y-4">
      <AdminNav />

      {/* Header */}
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>
              Admin · Missing Links Report
            </h1>
            <p className="text-sm text-neutral-600">{tournament.name} {tournament.year}</p>
          </div>
          <Link
            href="/admin/links"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'var(--fd-maroon)' }}
          >
            → Bulk Link Editor
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total games', value: total, color: '#64748b', bg: '#f8fafc' },
          { label: 'Missing ticket link', value: missingTicket.length, sub: pct(missingTicket.length), color: '#dc2626', bg: '#fef2f2' },
          { label: 'Missing stream link', value: missingStream.length, sub: pct(missingStream.length), color: '#ea580c', bg: '#fff7ed' },
          { label: 'Missing both', value: missingBoth.length, sub: pct(missingBoth.length), color: '#9333ea', bg: '#faf5ff' },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className="rounded-xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: bg }}>
            <p className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs font-semibold mt-1" style={{ color }}>{label}</p>
            {sub && <p className="text-xs mt-0.5" style={{ color: `${color}99` }}>{sub} of total</p>}
          </div>
        ))}
      </div>

      {/* Partner Help */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--fd-maroon)', borderStyle: 'dashed', background: '#fef7f7' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--fd-maroon)' }}>
          📋 What Partners Need to Provide
        </p>
        <div className="grid gap-3 sm:grid-cols-2 text-xs" style={{ color: 'var(--neutral-600)' }}>
          <div>
            <p className="font-semibold mb-1">🎟️ GuamTime (Ticketing)</p>
            <ul className="space-y-0.5 text-[11px]">
              <li>• Ticket purchase URLs per game (or single event page)</li>
              <li>• Match by date + matchup from our CSV export</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">📺 Clutch (Streaming)</p>
            <ul className="space-y-0.5 text-[11px]">
              <li>• Stream/replay URLs per game</li>
              <li>• Can be live or VOD links</li>
            </ul>
          </div>
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'var(--neutral-400)' }}>
          Export CSVs: <code>docs/exports/missing-ticket-links.csv</code> and <code>missing-stream-links.csv</code>
        </p>
      </div>

      {/* Coverage bar */}
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--neutral-500)' }}>
          Link Coverage
        </p>
        <div className="space-y-2">
          {[
            { label: 'Ticket links', filled: total - missingTicket.length, color: '#16a34a' },
            { label: 'Stream links', filled: total - missingStream.length, color: '#0369a1' },
          ].map(({ label, filled, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--neutral-500)' }}>
                <span>{label}</span>
                <span>{filled} / {total}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--neutral-100)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: total ? `${(filled / total) * 100}%` : '0%', background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table of games missing at least one link */}
      {hasEither.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-sm font-medium" style={{ color: '#16a34a' }}>
            ✅ All games have both ticket and stream links!
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'var(--neutral-50)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--fd-ink)' }}>
              Games missing at least one link ({hasEither.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold uppercase tracking-[0.07em]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--neutral-500)' }}>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Matchup</th>
                  <th className="px-4 py-3">Div</th>
                  <th className="px-4 py-3">Phase</th>
                  <th className="px-4 py-3 text-center">🎟️ Ticket</th>
                  <th className="px-4 py-3 text-center">📺 Stream</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {hasEither.map(g => {
                  const phase = g.bracketCode === 'FS' ? 'Father-Son' : g.bracketCode ? 'Playoff' : 'Pool'
                  const div = g.division ?? g.homeTeam.division ?? '—'
                  return (
                    <tr
                      key={g.id}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-xs" style={{ color: 'var(--neutral-500)' }}>
                        {new Date(g.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: 'var(--fd-ink)' }}>
                          {g.awayTeam.displayName} vs {g.homeTeam.displayName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--neutral-500)' }}>{div}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--neutral-500)' }}>
                        {phase}
                        {g.bracketCode && g.bracketCode !== 'FS' && (
                          <span className="ml-1 rounded px-1 py-0.5 text-[10px] font-bold" style={{ background: '#f0f0f0', color: '#555' }}>
                            {g.bracketCode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {g.ticketUrl ? (
                          <span style={{ color: '#16a34a' }}>✓</span>
                        ) : (
                          <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {g.streamUrl ? (
                          <span style={{ color: '#16a34a' }}>✓</span>
                        ) : (
                          <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>Missing</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
