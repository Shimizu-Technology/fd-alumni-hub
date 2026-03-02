import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'
import { RecomputeStandingsButton } from '@/components/admin/recompute-standings-button'

export const dynamic = 'force-dynamic'

export default async function AdminStandingsPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>

  const standings = await db.standing.findMany({
    where: { tournamentId: tournament.id },
    include: { team: true },
    orderBy: [{ wins: 'desc' }, { losses: 'asc' }, { pointsFor: 'desc' }],
  })

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · Standings</h1>
        <p className="text-sm text-neutral-600">{tournament.name} {tournament.year}</p>
      </div>

      <RecomputeStandingsButton tournamentId={tournament.id} />

      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: 'var(--border-subtle)' }}>
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100/70 text-left text-neutral-700">
            <tr>
              <th className="px-4 py-3">Team</th><th className="px-3 py-3 text-right">W</th><th className="px-3 py-3 text-right">L</th><th className="px-3 py-3 text-right">PF</th><th className="px-3 py-3 text-right">PA</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <td className="px-4 py-2">{s.team.displayName}</td>
                <td className="px-3 py-2 text-right">{s.wins}</td>
                <td className="px-3 py-2 text-right">{s.losses}</td>
                <td className="px-3 py-2 text-right">{s.pointsFor}</td>
                <td className="px-3 py-2 text-right">{s.pointsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
