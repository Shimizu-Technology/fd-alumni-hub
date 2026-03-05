import { db } from '@/lib/db'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import {
  Users,
  Gamepad2,
  AlertTriangle,
  Video,
  Trophy,
  CheckCircle2,
} from 'lucide-react'

export async function DataHealthCard() {
  const tournament = await getActiveTournament()
  if (!tournament) {
    return (
      <div
        className="rounded-xl border bg-white p-5 shadow-sm"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--neutral-100)]">
            <AlertTriangle className="h-5 w-5 text-[var(--neutral-500)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--fd-ink)]">Data Health</h2>
            <p className="text-xs text-[var(--neutral-500)]">No active tournament found.</p>
          </div>
        </div>
      </div>
    )
  }

  const [teams, games, finalNoScores, streamMissing, standings] = await Promise.all([
    db.team.count({ where: { tournamentId: tournament.id } }),
    db.game.count({ where: { tournamentId: tournament.id } }),
    db.game.count({
      where: {
        tournamentId: tournament.id,
        status: 'final',
        OR: [{ homeScore: null }, { awayScore: null }],
      },
    }),
    db.game.count({
      where: {
        tournamentId: tournament.id,
        status: { in: ['scheduled', 'live'] },
        streamUrl: null,
      },
    }),
    db.standing.count({ where: { tournamentId: tournament.id } }),
  ])

  const hasIssues = finalNoScores > 0 || streamMissing > 0

  return (
    <div
      className="rounded-xl border bg-white p-5 shadow-sm transition-all duration-200"
      style={{ borderColor: hasIssues ? 'var(--status-live)' : 'var(--border-subtle)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              background: hasIssues ? 'var(--status-live-bg)' : '#f0fdf4',
            }}
          >
            {hasIssues ? (
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--status-live)' }} />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--fd-ink)]">
              Data Health · {tournament.year}
            </h2>
            <p className="text-xs text-[var(--neutral-500)]">
              {hasIssues ? 'Some items need attention' : 'All systems healthy'}
            </p>
          </div>
        </div>
        {hasIssues && (
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{
            background: 'var(--status-live-bg)',
            color: 'var(--status-live)',
          }}>
            {finalNoScores + streamMissing} issue{finalNoScores + streamMissing !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric icon={Users} label="Teams" value={teams} />
        <Metric icon={Gamepad2} label="Games" value={games} />
        <Metric
          icon={AlertTriangle}
          label="Finals missing scores"
          value={finalNoScores}
          alert={finalNoScores > 0}
        />
        <Metric
          icon={Video}
          label="Missing stream"
          value={streamMissing}
          alert={streamMissing > 0}
        />
        <Metric icon={Trophy} label="Standings rows" value={standings} />
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  alert = false,
}: {
  icon: React.ElementType
  label: string
  value: number
  alert?: boolean
}) {
  return (
    <div
      className="group relative rounded-lg border px-3 py-2.5 transition-all duration-200 hover:shadow-sm"
      style={{
        borderColor: alert ? 'var(--status-live)' : 'var(--border-subtle)',
        background: alert ? 'var(--status-live-bg)' : 'var(--bg-card-subtle)',
      }}
    >
      <div className="flex items-center gap-2">
        <Icon
          className="h-4 w-4 shrink-0"
          style={{ color: alert ? 'var(--status-live)' : 'var(--neutral-400)' }}
        />
        <p className="truncate text-xs text-[var(--neutral-500)]">{label}</p>
      </div>
      <p
        className="mt-1 text-lg font-bold tabular-nums"
        style={{ color: alert ? 'var(--status-live)' : 'var(--fd-ink)' }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  )
}
