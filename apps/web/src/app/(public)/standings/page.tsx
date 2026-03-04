export const dynamic = 'force-dynamic'

import { getStandings } from '@/lib/services/public-feed'

export default async function StandingsPage() {
  const { tournament, standings } = await getStandings()

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-white/90 p-6" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-3xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Standings</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
        </p>
      </div>

      {!tournament || standings.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-sm text-neutral-600" style={{ borderColor: 'var(--border-subtle)' }}>
          No standings yet. Add teams/scores from admin.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: 'var(--border-subtle)' }}>
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-neutral-100/90 text-left text-neutral-700 backdrop-blur">
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
              {standings.map((row, idx) => {
                const diff = row.pointsFor - row.pointsAgainst
                return (
                  <tr
                    key={row.id}
                    className={`border-t transition-colors hover:bg-neutral-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'}`}
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-4 py-3 font-medium">{row.team.displayName}</td>
                    <td className="px-3 py-3 text-right">{row.wins}</td>
                    <td className="px-3 py-3 text-right">{row.losses}</td>
                    <td className="px-3 py-3 text-right">{row.pointsFor}</td>
                    <td className="px-3 py-3 text-right">{row.pointsAgainst}</td>
                    <td className={`px-3 py-3 text-right font-medium ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-neutral-600'}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
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
