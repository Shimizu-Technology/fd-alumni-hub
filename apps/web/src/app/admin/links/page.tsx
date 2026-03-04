import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'
import { BulkLinkEditor } from '@/components/admin/bulk-link-editor'

export const dynamic = 'force-dynamic'

export default async function AdminLinksPage() {
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
    take: 500,
  })

  const missingTicket = games.filter(g => !g.ticketUrl).length
  const missingStream = games.filter(g => !g.streamUrl).length

  return (
    <section className="space-y-4">
      <AdminNav />
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · Bulk Link Editor</h1>
        <p className="text-sm text-neutral-600 mb-3">{tournament.name} {tournament.year}</p>
        <div className="flex flex-wrap gap-4">
          <div className="rounded-lg px-3 py-2 text-sm font-medium" style={{ background: missingTicket > 0 ? '#fef2f2' : '#f0fdf4', color: missingTicket > 0 ? '#dc2626' : '#16a34a' }}>
            🎟️ {missingTicket} games missing ticket link
          </div>
          <div className="rounded-lg px-3 py-2 text-sm font-medium" style={{ background: missingStream > 0 ? '#fef2f2' : '#f0fdf4', color: missingStream > 0 ? '#dc2626' : '#16a34a' }}>
            📺 {missingStream} games missing stream link
          </div>
        </div>
        {/* Partner Integration Help */}
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--neutral-50)' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--fd-maroon)' }}>
            🤝 Partner Integration Quick Guide
          </p>
          <ul className="text-xs space-y-1.5" style={{ color: 'var(--neutral-600)' }}>
            <li>• <strong>GuamTime (Tickets):</strong> Use Bulk Fill to apply ticket URLs by filtering a division/phase first</li>
            <li>• <strong>Clutch (Streams):</strong> Same workflow — filter, then bulk apply stream URLs</li>
            <li>• <strong>Per-game edits:</strong> Scroll down and edit individual game URLs directly</li>
            <li>• <strong>Save:</strong> Changes are highlighted with a maroon border. Click &quot;Save All Changes&quot; when done</li>
          </ul>
          <p className="text-[10px] mt-2" style={{ color: 'var(--neutral-400)' }}>
            Need CSVs for partners? See <code>docs/exports/</code> or run <code>npm run partner-package</code>
          </p>
        </div>
      </div>
      <BulkLinkEditor initialGames={games as any} />
    </section>
  )
}
