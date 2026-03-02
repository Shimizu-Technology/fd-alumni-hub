import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'
import { GameEditor } from '@/components/admin/game-editor'

export const dynamic = 'force-dynamic'

export default async function AdminGamesPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) {
    return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>
  }

  const games = await db.game.findMany({
    where: { tournamentId: tournament.id },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { startTime: 'asc' },
    take: 300,
  })

  return (
    <section className="space-y-4">
      <AdminNav />
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · Games</h1>
        <p className="text-sm text-neutral-600">{tournament.name} {tournament.year}</p>
      </div>
      <GameEditor initialGames={games as any} />
    </section>
  )
}
