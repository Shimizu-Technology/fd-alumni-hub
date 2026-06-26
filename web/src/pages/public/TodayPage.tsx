import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatGuamDate, formatGuamDateTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { useAsync } from '../../lib/hooks'
import type { Game, PredictionPoll, RosterEntry } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'
import { IconArrowRight, IconExternal } from '../../components/Icons'

const voterTokenKey = 'fd-alumni-voter-token'

export function TodayPage() {
  const [voterToken] = useState(readOrCreateVoterToken)
  const [pollOverrides, setPollOverrides] = useState<Record<string, PredictionPoll>>({})
  const [voteError, setVoteError] = useState('')
  const { data, loading, error, reload } = useAsync(() => api.publicToday({}, voterToken), [voterToken])

  const polls = useMemo(() => {
    const base = data?.predictionPolls || []
    return base.map((poll) => pollOverrides[poll.id] || poll)
  }, [data?.predictionPolls, pollOverrides])

  const tournamentPolls = useMemo(() => polls.filter((poll) => poll.pollType === 'tournament'), [polls])
  const gamePolls = useMemo(() => new Map(polls.filter((poll) => poll.pollType === 'game' && poll.gameId).map((poll) => [poll.gameId!, poll])), [polls])

  const vote = async (poll: PredictionPoll, teamId: string) => {
    setVoteError('')
    try {
      const result = await api.publicVotePrediction(poll.id, { teamId, voterToken })
      setPollOverrides((current) => ({ ...current, [poll.id]: result.predictionPoll }))
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'Unable to save prediction')
    }
  }

  if (loading && !data) return <LoadingState label="Loading today at The Jungle" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack today-page">
      <PageHeader
        eyebrow="Today at The Jungle"
        title="Game-day guide"
        description={data?.date ? `${formatGuamDate(data.date, { weekday: 'long' })} · live info, ticket links, stream links, rosters, and fan predictions.` : 'Live game-day info, ticket links, stream links, rosters, and fan predictions.'}
        actions={<Link className="btn secondary" to="/schedule">Full schedule <IconArrowRight /></Link>}
      />

      <section className="today-brief-grid">
        <Panel className="today-brief-card">
          <span>Host class</span>
          <strong>{data?.gameDayNote?.hostClass || 'Host details pending'}</strong>
        </Panel>
        <Panel className="today-brief-card">
          <span>Food / menu</span>
          <strong>{data?.gameDayNote?.foodMenu || 'Food notes pending'}</strong>
        </Panel>
        <Panel className="today-brief-card today-brief-card--wide">
          <span>Announcements</span>
          <strong>{data?.gameDayNote?.announcement || 'No announcements posted yet.'}</strong>
          {data?.lastUpdatedAt && <small>Last updated {formatGuamDateTime(data.lastUpdatedAt)}</small>}
        </Panel>
      </section>

      {data?.gameDayNote?.sponsorShoutout && <Panel className="notice-panel">{data.gameDayNote.sponsorShoutout}</Panel>}

      {voteError && <p className="form-error" role="alert">{voteError}</p>}

      {tournamentPolls.length > 0 && (
        <Panel>
          <div className="section-heading"><h2>Tournament predictions</h2><span>{tournamentPolls.length}</span></div>
          <div className="prediction-grid">
            {tournamentPolls.map((poll) => <PredictionPollCard key={poll.id} poll={poll} onVote={vote} />)}
          </div>
        </Panel>
      )}

      <Panel>
        <div className="section-heading"><h2>Games today</h2><span>{data?.games.length || 0}</span></div>
        {!data?.games.length ? <EmptyState title="No games scheduled today" description="Check the full schedule for the next matchup at The Jungle." /> : (
          <div className="today-game-list">
            {data.games.map((game) => <TodayGameCard key={game.id} game={game} poll={gamePolls.get(game.id)} onVote={vote} />)}
          </div>
        )}
      </Panel>
    </div>
  )
}

function TodayGameCard({ game, poll, onVote }: { game: Game; poll?: PredictionPoll; onVote: (poll: PredictionPoll, teamId: string) => Promise<void> }) {
  return (
    <article className={poll ? 'today-game-card' : 'today-game-card today-game-card--no-poll'}>
      <div className="today-game-main">
        <div className="game-card-top">
          <span>{formatGuamDateTime(game.startTime)}</span>
          <StatusBadge status={game.status} />
        </div>
        <h2>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</h2>
        <p>{game.venue || DEFAULT_GAME_VENUE}</p>
        <div className="game-actions">
          {game.ticketUrl ? <a className="btn secondary small" href={game.ticketUrl} target="_blank" rel="noreferrer">Tickets <IconExternal /></a> : <span className="link-muted">Tickets pending</span>}
          {game.streamUrl ? <a className="btn primary small" href={game.streamUrl} target="_blank" rel="noreferrer">Stream <IconExternal /></a> : <span className="link-muted">Stream pending</span>}
        </div>
        <RosterDetails game={game} />
      </div>
      {poll && <PredictionPollCard poll={poll} onVote={onVote} compact />}
    </article>
  )
}

function RosterDetails({ game }: { game: Game }) {
  const awayRoster = activeRoster(game.awayTeam?.rosterEntries)
  const homeRoster = activeRoster(game.homeTeam?.rosterEntries)
  if (!awayRoster.length && !homeRoster.length) return null

  return (
    <details className="roster-details">
      <summary>Rosters</summary>
      <div className="roster-columns">
        <RosterList title={game.awayTeam?.displayName || 'Away team'} entries={awayRoster} />
        <RosterList title={game.homeTeam?.displayName || 'Home team'} entries={homeRoster} />
      </div>
    </details>
  )
}

function RosterList({ title, entries }: { title: string; entries: RosterEntry[] }) {
  return <div><h3>{title}</h3>{entries.length ? <ul>{entries.map((entry) => <li key={entry.id}>{entry.jerseyNumber && <span>#{entry.jerseyNumber}</span>}<strong>{entry.name}</strong>{entry.nickname && <small>“{entry.nickname}”</small>}{entry.position && <small>{entry.position}</small>}</li>)}</ul> : <p className="muted">Roster pending</p>}</div>
}

function PredictionPollCard({ poll, onVote, compact = false }: { poll: PredictionPoll; onVote: (poll: PredictionPoll, teamId: string) => Promise<void>; compact?: boolean }) {
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null)

  const choose = async (teamId: string) => {
    setSavingTeamId(teamId)
    try {
      await onVote(poll, teamId)
    } finally {
      setSavingTeamId(null)
    }
  }

  return (
    <div className={`prediction-card ${compact ? 'compact' : ''}`}>
      <div className="prediction-card-head">
        <span>{poll.open ? 'Voting open' : 'Voting closed'}</span>
        <strong>{poll.question}</strong>
      </div>
      <div className="prediction-options">
        {poll.options.map((option) => (
          <button key={option.teamId} type="button" className={option.selected ? 'selected' : ''} onClick={() => choose(option.teamId)} disabled={!poll.open || savingTeamId !== null}>
            <span>{option.displayName}</span>
            {poll.resultsVisible && <small>{option.percent ?? 0}% · {option.votes ?? 0} votes</small>}
            {!poll.resultsVisible && <small>Vote to reveal</small>}
          </button>
        ))}
      </div>
      {poll.selectedTeamId && poll.open && <small className="prediction-note">Vote saved. Tap another team to change it.</small>}
    </div>
  )
}

function activeRoster(entries?: RosterEntry[]) {
  return (entries || []).filter((entry) => entry.active)
}

function readOrCreateVoterToken() {
  try {
    const existing = window.localStorage.getItem(voterTokenKey)
    if (existing) return existing

    const token = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(voterTokenKey, token)
    return token
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}
