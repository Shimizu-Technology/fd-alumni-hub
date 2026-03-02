export const dynamic = 'force-dynamic'

import { getStandings } from '@/lib/services/public-feed'

export default async function StandingsPage() {
  const { tournament, standings } = await getStandings()

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Standings</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
        </p>
      </div>

      {!tournament || standings.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-neutral-600" style={{ borderColor: 'var(--border-subtle)' }}>
          No standings yet. Add teams/scores from admin.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: 'var(--border-subtle)' }}>
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100/70 text-left text-neutral-700">
              <tr>
                <th className="px-4 py-3">Team</th>
                <th className="px-3 py-3 text-right">W</th>
                <th className="px-3 py-3 text-right">L</th>
                <th className="px-3 py-3 text-right">PF</th>
                <th className="px-3 py-3 text-right">PA</th>
                <th className="px-3 py-3 text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const diff = row.pointsFor - row.pointsAgainst
                return (
                  <tr key={row.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-4 py-3 font-medium">{row.team.displayName}</td>
                    <td className="px-3 py-3 text-right">{row.wins}</td>
                    <td className="px-3 py-3 text-right">{row.losses}</td>
                    <td className="px-3 py-3 text-right">{row.pointsFor}</td>
                    <td className="px-3 py-3 text-right">{row.pointsAgainst}</td>
                    <td className="px-3 py-3 text-right">{diff > 0 ? `+${diff}` : diff}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
