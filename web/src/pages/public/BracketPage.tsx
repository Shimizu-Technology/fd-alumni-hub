import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatGuamDateTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { useAsync } from '../../lib/hooks'
import { numericSearchParam } from '../../lib/urls'
import type { BracketDivisionGroup, Game } from '../../lib/types'
import { EmptyState, LoadingState, PageHeader, Panel, SectionUnavailable, StatusBadge } from '../../components/ui'
import { IconArrowRight } from '../../components/Icons'

export function BracketPage() {
  const [year] = useState(() => numericSearchParam('year'))
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('')
  const [selectedRound, setSelectedRound] = useState<string>('')

  const { data, loading, error, reload } = useAsync(
    () => api.publicBracket({ year }),
    [year],
  )

  const divisions = data?.divisions || []
  const activeDivision: BracketDivisionGroup | null =
    divisions.find((d) => d.division.id === selectedDivisionId) || divisions[0] || null

  const rounds = activeDivision?.rounds || []
  const activeRoundKey = rounds.some((r) => r.round === selectedRound) ? selectedRound : (rounds[0]?.round || '')
  const activeMobileRound = rounds.find((r) => r.round === activeRoundKey) || rounds[0] || null

  useEffect(() => {
    if (activeDivision && selectedDivisionId !== activeDivision.division.id) {
      setSelectedDivisionId(activeDivision.division.id)
    }
  }, [activeDivision, selectedDivisionId])

  useEffect(() => {
    if (rounds.length > 0 && !rounds.some((r) => r.round === selectedRound)) {
      setSelectedRound(rounds[0].round)
    }
  }, [rounds, selectedRound])

  return (
    <div className="page-stack bracket-page">
      <PageHeader
        eyebrow={data?.tournament ? `${data.tournament.year} playoffs` : 'Playoffs'}
        title="Playoff bracket"
        description="Single-elimination tournament brackets by division. Winners automatically advance as final scores are recorded."
        actions={
          <>
            <Link className="btn secondary" to="/schedule">Full schedule <IconArrowRight /></Link>
            <Link className="btn secondary" to="/standings">Standings</Link>
          </>
        }
      />

      {loading && !data ? (
        <LoadingState label="Loading playoff bracket" />
      ) : error && !data ? (
        <SectionUnavailable
          title="Playoff bracket is temporarily unavailable"
          description="Could not load bracket matchups right now. Try again or browse tournament history."
          onRetry={reload}
          action={<Link className="btn secondary" to="/history">Browse history</Link>}
        />
      ) : divisions.length === 0 ? (
        <EmptyState
          title="Playoff bracket not posted yet"
          description="Playoff matchups will appear here once pool play concludes and brackets are seeded."
          action={<Link className="btn primary" to="/standings">View current standings</Link>}
        />
      ) : (
        <>
          {divisions.length > 1 && (
            <Panel className="bracket-tabs-panel">
              <div className="bracket-division-tabs" role="group" aria-label="Playoff divisions">
                {divisions.map((group) => {
                  const isActive = group.division.id === activeDivision?.division.id
                  return (
                    <button
                      key={group.division.id}
                      type="button"
                      aria-pressed={isActive}
                      className={`bracket-tab-btn${isActive ? ' active' : ''}`}
                      onClick={() => {
                        setSelectedDivisionId(group.division.id)
                        setSelectedRound(group.rounds[0]?.round || '')
                      }}
                    >
                      {group.division.name}
                    </button>
                  )
                })}
              </div>
            </Panel>
          )}

          {activeDivision && (
            <section className="bracket-section" aria-label={`${activeDivision.division.name} playoff bracket`}>
              <div className="bracket-round-pills" role="group" aria-label="Playoff rounds">
                {rounds.map((roundGroup) => {
                  const isActive = roundGroup.round === activeRoundKey
                  return (
                    <button
                      key={roundGroup.round}
                      type="button"
                      aria-pressed={isActive}
                      className={`bracket-pill-btn${isActive ? ' active' : ''}`}
                      onClick={() => setSelectedRound(roundGroup.round)}
                    >
                      <span>{roundGroup.label}</span>
                      <small>{roundGroup.games.length}</small>
                    </button>
                  )
                })}
              </div>

              {activeMobileRound && (
                <div className="bracket-mobile-round">
                  <h2>{activeDivision.division.name} · {activeMobileRound.label}</h2>
                  <div className="bracket-round-list">
                    {activeMobileRound.games.map((game) => <BracketGameCard key={game.id} game={game} />)}
                  </div>
                </div>
              )}

              <div className="bracket-desktop-grid">
                {rounds.map((roundGroup) => (
                  <div key={roundGroup.round} className="bracket-column">
                    <h2 className="bracket-column-heading">
                      <span>{roundGroup.label}</span>
                      <small>{roundGroup.games.length}</small>
                    </h2>
                    <div className="bracket-round-list">
                      {roundGroup.games.map((game) => <BracketGameCard key={game.id} game={game} />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function BracketGameCard({ game }: { game: Game }) {
  const hasScore = game.homeScore !== null && game.awayScore !== null
  const isFinal = game.status === 'final'
  const awayWon = isFinal && (game.officialWinnerTeamId
    ? game.officialWinnerTeamId === game.awayTeamId : hasScore && (game.awayScore ?? 0) > (game.homeScore ?? 0))
  const homeWon = isFinal && (game.officialWinnerTeamId
    ? game.officialWinnerTeamId === game.homeTeamId : hasScore && (game.homeScore ?? 0) > (game.awayScore ?? 0))

  return (
    <article className={`panel bracket-card${game.placeholder ? ' bracket-card--placeholder' : ''}`}>
      <div className="bracket-card-head">
        <span className="bracket-card-code">
          {game.bracketCode || game.gameNumber || (game.bracketSlot ? `Game ${game.bracketSlot}` : 'Playoff')}
        </span>
        <StatusBadge status={game.status} />
      </div>

      <div className="bracket-matchup">
        <div className={`bracket-team-row${awayWon ? ' winner' : ''}`}>
          <span className="bracket-team-name">
            {game.awayTeam ? <Link to={`/teams/${game.awayTeam.id}`}>{game.awayTeam.displayName}</Link> : 'TBD'}
            {awayWon && <span className="sr-only"> (Winner)</span>}
          </span>
          <strong className="bracket-team-score">{hasScore ? game.awayScore : '—'}</strong>
        </div>
        <div className={`bracket-team-row${homeWon ? ' winner' : ''}`}>
          <span className="bracket-team-name">
            {game.homeTeam ? <Link to={`/teams/${game.homeTeam.id}`}>{game.homeTeam.displayName}</Link> : 'TBD'}
            {homeWon && <span className="sr-only"> (Winner)</span>}
          </span>
          <strong className="bracket-team-score">{hasScore ? game.homeScore : '—'}</strong>
        </div>
      </div>

      {game.statusNote && <p className="game-status-note">{game.statusNote}</p>}

      <p className="bracket-card-meta">
        <span>{formatGuamDateTime(game.startTime)}</span>
        <span> · {game.venue || DEFAULT_GAME_VENUE}</span>
      </p>
    </article>
  )
}
