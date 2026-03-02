import { db } from '@/lib/db'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'

export async function DataHealthCard() {
  const tournament = await getActiveTournament()
  if (!tournament) {
    return (
      <div className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-sm font-semibold">Data Health</h2>
        <p className="mt-1 text-xs text-neutral-600">No active tournament found.</p>
      </div>
    )
  }

  const [teams, games, finalNoScores, streamMissing, standings] = await Promise.all([
    db.team.count({ where: { tournamentId: tournament.id } }),
    db.game.count({ where: { tournamentId: tournament.id } }),
    db.game.count({ where: { tournamentId: tournament.id, status: 'final', OR: [{ homeScore: null }, { awayScore: null }] } }),
    db.game.count({ where: { tournamentId: tournament.id, status: { in: ['scheduled', 'live'] }, streamUrl: null } }),
    db.standing.count({ where: { tournamentId: tournament.id } }),
  ])

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold">Data Health · {tournament.year}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
        <Metric label="Teams" value={teams} />
        <Metric label="Games" value={games} />
        <Metric label="Finals missing scores" value={finalNoScores} alert={finalNoScores > 0} />
        <Metric label="Sched/Live missing stream" value={streamMissing} alert={streamMissing > 0} />
        <Metric label="Standings rows" value={standings} />
      </div>
    </div>
  )
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <p className="text-neutral-500">{label}</p>
      <p className={`mt-1 text-base font-semibold ${alert ? 'text-red-700' : ''}`}>{value}</p>
    </div>
  )
}
