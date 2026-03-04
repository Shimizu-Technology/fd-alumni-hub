import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'
import { GameEditor } from '@/components/admin/game-editor'
import { GameCreateForm } from '@/components/admin/game-create-form'
import { getDivision } from '@/lib/divisions'

export const dynamic = 'force-dynamic'

export default async function AdminGamesPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) {
    return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>
  }

  const [games, teams] = await Promise.all([
    db.game.findMany({
      where: { tournamentId: tournament.id },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { startTime: 'asc' },
      take: 300,
    }),
    db.team.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ division: 'asc' }, { displayName: 'asc' }],
    }),
  ])

  const teamOptions = teams.map(t => ({
    id: t.id,
    displayName: t.displayName,
    division: t.division,
  }))

  // Division summary for header
  const divCounts = teams.reduce((acc: Record<string, number>, t) => {
    const key = t.division ?? 'Unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="space-y-4">
      <AdminNav />
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · Games</h1>
        <p className="text-sm text-neutral-600 mb-3">{tournament.name} {tournament.year}</p>
        {/* Division summary */}
        <div className="flex flex-wrap gap-2">
          {(Object.entries(divCounts) as Array<[string, number]>).map(([divId, count]) => {
            const div = getDivision(divId)
            return (
              <span
                key={divId}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background: div?.colorMuted ?? '#f3f4f7',
                  color: div?.color ?? '#485063',
                }}
              >
                {divId}: {count} {count === 1 ? 'team' : 'teams'}
              </span>
            )
          })}
        </div>
      </div>
      <GameCreateForm tournamentId={tournament.id} teams={teamOptions} />
      <GameEditor initialGames={games as any} />
    </section>
  )
}
