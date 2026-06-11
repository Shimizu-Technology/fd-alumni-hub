import { useState } from 'react'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime } from '../../lib/datetime'
import type { Game, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard } from '../../components/ui'

export function AdminMissingLinksPage() {
  const [tournamentId, setTournamentId] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, missing] = await Promise.all([api.adminTournaments(), api.adminMissingLinks(tournamentId || null)])
    return { tournaments: tournaments.tournaments, ...missing }
  }, [tournamentId])

  if (loading && !data) return <LoadingState label="Checking data health" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Missing links and scores" description="Operational view of games still missing tickets, streams, or final scores." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournamentId} onChange={setTournamentId} />
      <div className="stats-grid three"><StatCard label="Missing tickets" value={data?.summary.missingTickets || 0} /><StatCard label="Missing streams" value={data?.summary.missingStreams || 0} /><StatCard label="Missing scores" value={data?.summary.missingScores || 0} tone="gold" /></div>
      <MissingPanel title="Tickets missing" games={data?.missingTickets || []} />
      <MissingPanel title="Streams missing" games={data?.missingStreams || []} />
      <MissingPanel title="Final scores missing" games={data?.missingScores || []} />
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Active or latest</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function MissingPanel({ title, games }: { title: string; games: Game[] }) {
  return <Panel><div className="section-heading"><h2>{title}</h2><span>{games.length}</span></div>{games.length === 0 ? <EmptyState title="Nothing missing in this category" /> : <div className="compact-list">{games.slice(0, 50).map((game) => <div key={game.id} className="compact-row"><span>{formatGuamDateTime(game.startTime)}</span><strong>{game.awayTeam?.displayName} at {game.homeTeam?.displayName}</strong><small>{game.venue || 'Venue TBD'}</small></div>)}</div>}</Panel>
}
