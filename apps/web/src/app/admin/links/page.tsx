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
      </div>
      <BulkLinkEditor initialGames={games as any} />
    </section>
  )
}
