import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatGuamDateTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, gameResultLabel } from '../../lib/games'
import { useAsync } from '../../lib/hooks'
import type { Article, Game, RosterEntry, Team } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui'
import { IconArrowRight, IconExternal } from '../../components/Icons'

export function TeamProfilePage() {
  const { teamId = '' } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    if (!teamId) throw new Error('Class profile not found')
    return api.publicTeam(teamId)
  }, [teamId])

  if (loading && !data) return <LoadingState label="Loading class profile" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <EmptyState title="Class profile unavailable" />

  const titles = data.titleRecords
  const roster = activeRoster(data.team.rosterEntries)
  const finalGames = data.games.filter((game) => game.status === 'final')
  const nextGame = nextUpcomingGame(data.games)
  const recordLabel = data.standing ? `${data.standing.wins}–${data.standing.losses}` : 'Pending'

  return (
    <div className="page-stack team-profile-page">
      <PageHeader
        eyebrow={`${data.tournament.year} class profile`}
        title={data.team.displayName}
        description={`${data.team.division || 'Division pending'} · ${data.tournament.name}. View this class roster, schedule, results, and title history.`}
        actions={<Link className="btn secondary" to={`/schedule?year=${data.tournament.year}&teamId=${data.team.id}`}>Schedule filter <IconArrowRight /></Link>}
      />

      <section className="team-profile-hero panel">
        <div>
          <span className="team-card-kicker">{data.team.classYearLabel}</span>
          <h2>{data.team.displayName}</h2>
          <p>{nextGame ? `Next game: ${teamGameLabel(nextGame)} · ${formatGuamDateTime(nextGame.startTime)}` : finalGames.length ? `${finalGames.length} completed games recorded.` : 'Schedule details are still being loaded.'}</p>
        </div>
        <div className="team-profile-hero-actions">
          <StatusBadge status={data.tournament.status} />
          <Link className="btn primary" to={`/standings?year=${data.tournament.year}&teamId=${data.team.id}`}>Find in standings</Link>
        </div>
      </section>

      <div className="stats-grid four">
        <StatCard label="Record" value={recordLabel} tone="maroon" />
        <StatCard label="Games" value={data.games.length} detail={`${finalGames.length} final`} />
        <StatCard label="Titles in archive" value={titles.length} detail={titles[0] ? `Latest ${titles[0].year}` : 'No verified titles yet'} tone="gold" />
        <StatCard label="Roster" value={roster.length} detail={roster.length ? 'players listed' : 'pending'} />
      </div>

      <div className="split-grid team-profile-split">
        <Panel>
          <div className="section-heading"><h2>Class schedule</h2><span>{data.games.length} games</span></div>
          {!data.games.length ? <EmptyState title="No games found" description="This class does not have games in the selected tournament yet." /> : <TeamGameList games={data.games} team={data.team} />}
        </Panel>
        <Panel>
          <div className="section-heading"><h2>Roster</h2><span>{roster.length}</span></div>
          {!roster.length ? <EmptyState title="Roster pending" description="Roster details will appear when organizers provide player information." /> : <RosterList entries={roster} />}
        </Panel>
      </div>

      <div className="split-grid team-profile-split">
        <Panel>
          <div className="section-heading"><h2>Title history</h2><span>{titles.length}</span></div>
          {!titles.length ? <EmptyState title="No verified titles in archive" description="Historical champion records are still being verified for older tournament years." /> : (
            <div className="title-history-list">
              {titles.map((record) => (
                <Link key={record.id} to={`/history/${record.year}`} className="title-history-row">
                  <strong>{record.year}</strong>
                  <span>{record.runnerUpLabel ? `Defeated ${record.runnerUpLabel}` : 'Champion record'}</span>
                  <small>{record.score ? `${record.score} · ` : ''}{record.source}</small>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel>
          <div className="section-heading"><h2>Related coverage</h2><span>{data.articles.length}</span></div>
          {!data.articles.length ? <EmptyState title="Coverage pending" description="Game-linked articles for this class will appear here." /> : <CoverageList articles={data.articles} />}
        </Panel>
      </div>
    </div>
  )
}

function TeamGameList({ games, team }: { games: Game[]; team: Team }) {
  return (
    <div className="team-game-list">
      {games.map((game) => {
        const opponent = game.homeTeamId === team.id ? game.awayTeam : game.homeTeam
        const scoreReady = game.homeScore !== null && game.awayScore !== null
        const teamScore = game.homeTeamId === team.id ? game.homeScore : game.awayScore
        const opponentScore = game.homeTeamId === team.id ? game.awayScore : game.homeScore
        const result = gameResultLabel(game)

        return (
          <article key={game.id} className="team-game-row">
            <div>
              <span>{formatGuamDateTime(game.startTime)}</span>
              <strong>{game.homeTeamId === team.id ? 'vs' : 'at'} {opponent?.displayName || 'Opponent TBD'}</strong>
              <small>{game.venue || DEFAULT_GAME_VENUE}{game.bracketCode ? ` · ${game.bracketCode}` : ''}</small>
              {result && <small>{result}</small>}
            </div>
            <div className="team-game-score"><StatusBadge status={game.status} />{scoreReady && <strong>{teamScore}–{opponentScore}</strong>}</div>
          </article>
        )
      })}
    </div>
  )
}

function RosterList({ entries }: { entries: RosterEntry[] }) {
  return (
    <div className="profile-roster-list">
      {entries.map((entry) => (
        <div key={entry.id}>
          <span>{entry.jerseyNumber ? `#${entry.jerseyNumber}` : 'Roster'}</span>
          <strong>{entry.name}</strong>
          {(entry.nickname || entry.position) && <small>{[entry.nickname && `“${entry.nickname}”`, entry.position].filter(Boolean).join(' · ')}</small>}
        </div>
      ))}
    </div>
  )
}

function CoverageList({ articles }: { articles: Article[] }) {
  return (
    <div className="compact-list">
      {articles.slice(0, 6).map((article) => (
        <a key={article.id} className="compact-row" href={article.url} target="_blank" rel="noreferrer">
          <span>{article.source}</span>
          <strong>{article.title}</strong>
          <small>Open source <IconExternal /></small>
        </a>
      ))}
    </div>
  )
}

function activeRoster(entries?: RosterEntry[]) {
  return (entries || []).filter((entry) => entry.active)
}

function nextUpcomingGame(games: Game[]) {
  const now = Date.now()
  return games
    .filter((game) => game.status !== 'final' && new Date(game.startTime).getTime() >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] || null
}

function teamGameLabel(game: Game) {
  return `${game.awayTeam?.displayName || 'Away team'} at ${game.homeTeam?.displayName || 'Home team'}`
}
