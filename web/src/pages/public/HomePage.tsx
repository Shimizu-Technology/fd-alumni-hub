import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { externalHref } from '../../lib/urls'
import { readOrCreateVoterToken } from '../../lib/voter'
import { formatGuamDateTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, formatTournamentWindow } from '../../lib/games'
import { EmptyState, ErrorState, LoadingState, Panel, StatCard } from '../../components/ui'
import { IconArrowRight, IconCalendar, IconPlay, IconTrophy } from '../../components/Icons'
import { PredictionPollCard } from '../../components/PredictionPollCard'
import type { Game, GameDayNote, PredictionPoll } from '../../lib/types'

const homeRefreshIntervalMs = 15_000

export function HomePage() {
  const [voterToken] = useState(readOrCreateVoterToken)
  const [pollOverrides, setPollOverrides] = useState<Record<string, PredictionPoll>>({})
  const [voteError, setVoteError] = useState('')
  const { data, loading, error, reload } = useAsync(() => api.publicHome(voterToken), [voterToken])

  useEffect(() => {
    setPollOverrides({})
  }, [data])

  useEffect(() => {
    if (!data) return undefined

    const intervalId = window.setInterval(() => {
      void reload()
    }, homeRefreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [data, reload])

  const homePolls = useMemo(() => {
    const base = data?.predictionPolls || []
    return base.map((poll) => pollOverrides[poll.id] || poll)
  }, [data?.predictionPolls, pollOverrides])
  const featuredPoll = useMemo(() => featuredPollForHome(homePolls), [homePolls])

  const vote = async (poll: PredictionPoll, teamId: string) => {
    setVoteError('')
    try {
      const result = await api.publicVotePrediction(poll.id, { teamId, voterToken })
      setPollOverrides((current) => ({ ...current, [poll.id]: result.predictionPoll }))
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'Unable to save prediction')
    }
  }

  if (loading && !data) return <LoadingState />
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <EmptyState title="Tournament data unavailable" />

  const tournamentLabel = data.tournament ? `${data.tournament.name} ${data.tournament.year}` : 'FD Alumni Tournament Hub'
  const featuredGames = featuredGamesForHome(data.liveGames, data.todayGames)
  const gameDayNote = data.gameDayNote
  const hasGameDayNote = hasHomeGameDayNote(gameDayNote)
  const heroTournament = data.upcomingOrLiveTournament || data.tournament
  const heroStatus = heroTournament ? `${heroTournament.year} · ${heroTournament.status}` : 'Schedule pending'
  const heroDates = heroTournament ? formatTournamentWindow(heroTournament) : 'Dates will appear once organizers publish them.'

  return (
    <div className="page-stack">
      <section className="hero-card public-hero-card">
        <div className="hero-text">
          <p className="eyebrow">Central hub · FD Alumni Basketball</p>
          <h1>Schedules, scores, streams, and stories from The Jungle.</h1>
          <p>{tournamentLabel}. A clean guide for alumni, families, and fans to follow the tournament while routing tickets, streams, and coverage to the right partners.</p>
          <div className="hero-actions">
            <Link className="btn primary" to="/today"><IconCalendar /> Today at The Jungle <IconArrowRight /></Link>
            <Link className="btn secondary" to="/schedule">Schedule</Link>
            <Link className="btn secondary" to="/standings"><IconTrophy /> Standings</Link>
            <Link className="btn secondary" to="/watch"><IconPlay /> Watch</Link>
          </div>
        </div>
        <div className="hero-panel">
          <span>Active tournament</span>
          <strong>{heroStatus}</strong>
          <small>{heroDates}</small>
          <div className="hero-panel-rule" aria-hidden="true" />
          <small>Game times, ticket links, stream links, and coverage stay organized in one place.</small>
        </div>
      </section>

      <div className="stats-grid">
        <StatCard label="Games today" value={data.todayGames.length} tone="maroon" />
        <StatCard label="Live now" value={data.liveGames.length} detail={data.liveGames.length ? 'Game in progress' : 'No active games'} tone={data.liveGames.length ? 'live' : 'neutral'} />
        <StatCard label="Latest news" value={data.latestNews.length} tone="gold" />
        <StatCard label="Tournament" value={data.tournament?.status?.toUpperCase() || 'READY'} detail={data.tournament?.year ? String(data.tournament.year) : 'Fallback ready'} />
      </div>

      <section className="split-grid">
        <Panel>
          <div className="section-heading home-today-heading">
            <h2>Today at The Jungle</h2>
            <div className="section-actions">
              <Link className="btn secondary small" to="/today">Open Today guide <IconArrowRight /></Link>
              <Link to="/schedule">Full schedule</Link>
            </div>
          </div>
          {hasGameDayNote && (
            <div className="home-today-note">
              <div className="home-today-note-grid">
                {gameDayNote.hostClass && <div><span>Host class</span><strong>{gameDayNote.hostClass}</strong></div>}
                {gameDayNote.foodMenu && <div><span>Food / menu</span><strong>{gameDayNote.foodMenu}</strong></div>}
              </div>
              {gameDayNote.announcement && <p>{gameDayNote.announcement}</p>}
              {gameDayNote.sponsorShoutout && <small>{gameDayNote.sponsorShoutout}</small>}
            </div>
          )}
          {featuredPoll ? (
            <div className="home-poll-callout">
              <div className="home-poll-copy">
                <span>Fan prediction</span>
                <strong>{featuredPoll.pollType === 'tournament' ? 'Vote on the tournament winner.' : 'Vote on today’s matchup.'}</strong>
                <small>No sign-in required. Results refresh automatically.</small>
              </div>
              {voteError && <p className="form-error" role="alert">{voteError}</p>}
              <PredictionPollCard poll={featuredPoll} onVote={vote} compact />
            </div>
          ) : (
            <div className="home-poll-teaser">
              <strong>Fan predictions</strong>
              <span>Polls open from the Today guide on game day. Vote with one tap when matchups are ready.</span>
            </div>
          )}
          {featuredGames.length === 0 ? (
            <EmptyState title="No games scheduled for today" description="Open the Today guide for game-day notes, or check the full schedule for upcoming matchups." action={<Link className="btn secondary" to="/today">See what’s posted today <IconArrowRight /></Link>} />
          ) : (
            <div className="compact-list">
              {featuredGames.map((game) => (
                <Link key={game.id} to="/today" className="compact-row">
                  <span>{formatGuamDateTime(game.startTime)}</span>
                  <strong>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</strong>
                  <small>{game.venue || DEFAULT_GAME_VENUE}</small>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="section-heading"><h2>Latest coverage</h2><Link to="/news">News archive</Link></div>
          {data.latestNews.length === 0 ? (
            <EmptyState title="Coverage links coming soon" description="Articles and recaps will appear here as local media and organizers publish updates." />
          ) : (
            <div className="compact-list">
              {data.latestNews.map((article) => (
                <a key={article.id} className="compact-row" href={article.url} target="_blank" rel="noreferrer">
                  <span>{article.source}</span>
                  <strong>{article.title}</strong>
                  {article.excerpt && <small>{article.excerpt}</small>}
                </a>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="partner-strip">
        <a href={externalHref(import.meta.env.VITE_GUAMTIME_URL || 'https://guamtime.net') || undefined} target="_blank" rel="noreferrer">
          <span>Tickets</span>
          <strong>Buy through GuamTime when game tickets are available.</strong>
        </a>
        <a href={externalHref(import.meta.env.VITE_CLUTCH_URL || 'https://www.clutchguam.com') || undefined} target="_blank" rel="noreferrer">
          <span>Streams</span>
          <strong>Watch live through Clutch or the approved stream partner for each game.</strong>
        </a>
        <div>
          <span>Coverage</span>
          <strong>Catch recaps, photos, and local coverage without losing the original source.</strong>
        </div>
      </section>
    </div>
  )
}

function featuredPollForHome(polls: PredictionPoll[]) {
  return polls.find((poll) => poll.open && poll.pollType === 'game') || polls.find((poll) => poll.open) || polls[0] || null
}

function featuredGamesForHome(liveGames: Game[], todayGames: Game[]) {
  const seenGameIds = new Set<string>()

  return [...liveGames, ...todayGames].filter((game) => {
    if (seenGameIds.has(game.id)) return false

    seenGameIds.add(game.id)
    return true
  }).slice(0, 6)
}

function hasHomeGameDayNote(note: GameDayNote | null): note is GameDayNote {
  return Boolean(note?.hostClass || note?.foodMenu || note?.announcement || note?.sponsorShoutout)
}
