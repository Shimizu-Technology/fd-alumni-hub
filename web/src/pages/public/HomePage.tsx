import { FindYourClassCard } from '../../components/FindYourClassCard'
import { LiveScoreboardStrip } from '../../components/LiveScoreboardStrip'
import { SeasonHero } from '../../components/SeasonHero'
import { useSiteMode } from '../../contexts/SiteModeContext'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { graduationYearFor } from '../../lib/history'
import { useAsync } from '../../lib/hooks'
import { readOrCreateVoterToken } from '../../lib/voter'
import { formatGuamDateTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { staticChampionRecords } from '../../lib/staticChampions'
import { LoadingState, Panel } from '../../components/ui'
import { IconArrowRight } from '../../components/Icons'
import { PredictionPollCard } from '../../components/PredictionPollCard'
import type { SiteSection } from '../../lib/siteMode'
import type { Game, GameDayNote, PredictionPoll } from '../../lib/types'

const homeRefreshIntervalMs = 15_000
const seasonLinks: { section: SiteSection; label: string; to: string }[] = [
  { section: 'schedule', label: 'Schedule', to: '/schedule' },
  { section: 'teams', label: 'Teams & Rosters', to: '/teams' },
  { section: 'standings', label: 'Standings', to: '/standings' },
  { section: 'bracket', label: 'Playoff Bracket', to: '/bracket' },
  { section: 'tickets', label: 'Tickets', to: '/tickets' },
  { section: 'sponsors', label: 'Sponsors', to: '/sponsors' },
]

export function HomePage() {
  const [voterToken] = useState(readOrCreateVoterToken)
  const [pollOverrides, setPollOverrides] = useState<Record<string, PredictionPoll>>({})
  const [voteError, setVoteError] = useState('')
  const { siteMode: layoutMode, acceptSiteMode } = useSiteMode()
  const { data, loading, error, reload } = useAsync(() => api.publicHome(voterToken), [voterToken])

  useEffect(() => {
    setPollOverrides({})
    if (data) acceptSiteMode(data)
  }, [data, acceptSiteMode])

  useEffect(() => {
    if (!data) return undefined

    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void reload()
    }, homeRefreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [data, reload])

  const homePolls = useMemo(() => {
    const base = data?.predictionPolls || []
    return base.map((poll) => pollOverrides[poll.id] || poll)
  }, [data?.predictionPolls, pollOverrides])
  const featuredPoll = useMemo(() => featuredPollForHome(homePolls), [homePolls])
  const recentOfflineChampions = useMemo(() => staticChampionRecords().slice(0, 6), [])

  const vote = async (poll: PredictionPoll, teamId: string) => {
    setVoteError('')
    try {
      const result = await api.publicVotePrediction(poll.id, { teamId, voterToken })
      setPollOverrides((current) => ({ ...current, [poll.id]: result.predictionPoll }))
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'Unable to save prediction')
    }
  }

  const siteMode = data?.siteMode || layoutMode
  const { mode, sections, hostCampaign, recap } = siteMode
  const scoreboardGames = combineGameDayGames(data?.liveGames || [], data?.todayGames || [])
  const featuredGames = scoreboardGames.slice(0, 6)
  const gameDayNote = data?.gameDayNote || null
  const hasGameDayNote = hasHomeGameDayNote(gameDayNote)
  const nextGame = data?.todayGames.find((game) => Date.parse(game.startTime) >= Date.now() && game.status === 'scheduled')
  const showHostCard = sections.fundraisers && (mode === 'schedule_ready' || (mode === 'tournament_recap' && recap.handoffBannerEnabled))
  const visibleSeasonLinks = seasonLinks.filter(({ section }) => sections[section])
  const isLive = mode === 'tournament_live'
  const champions = (data?.championRecords || []).filter((record) => record.championLabel)

  const gameDayPanel = data && sections.tonight && (
    <Panel>
      <div className="section-heading"><h2>Game-day updates</h2><Link to="/today">Tonight’s guide</Link></div>
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
      {featuredPoll && (
        <div className="home-poll-callout">
          <div className="home-poll-copy">
            <span>Fan prediction</span>
            <strong>{featuredPoll.pollType === 'tournament' ? 'Vote on the tournament winner.' : 'Vote on today’s matchup.'}</strong>
            <small>No sign-in required. Results refresh automatically.</small>
          </div>
          {voteError && <p className="form-error" role="alert">{voteError}</p>}
          <PredictionPollCard poll={featuredPoll} onVote={vote} compact />
        </div>
      )}
      {featuredGames.length > 0 && (
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
  )

  return (
    <div className="page-stack">
      <SeasonHero siteMode={siteMode} tournament={mode === 'fundraising' ? data?.upcomingOrLiveTournament || siteMode.tournament : siteMode.tournament} nextGame={nextGame} />
      {isLive && scoreboardGames.length > 0 && <LiveScoreboardStrip games={scoreboardGames} />}
      {isLive && gameDayPanel}
      <FindYourClassCard championRecords={data?.championRecords} hostClassYear={graduationYearFor(hostCampaign?.hostClass)} />
      {loading && !data && <LoadingState label="Loading tournament updates" />}
      {error && !data && (
        <Panel>
          <div className="section-heading">
            <h2>Recent champions</h2>
            <Link to="/history">Full history <IconArrowRight /></Link>
          </div>
          <div className="compact-list">
            {recentOfflineChampions.map((record) => (
              <Link key={record.id} to={`/history/${record.year}`} className="compact-row">
                <span>{record.label}</span><strong>{record.championLabel}</strong>
                {record.score && <small>{record.score}</small>}
              </Link>
            ))}
          </div>
        </Panel>
      )}
      {data && (
        <>
          {error && (
            <Panel className="notice-panel">
              <span>Live refresh failed. Showing the last loaded updates.</span>{' '}
              <button type="button" className="btn secondary small" onClick={() => void reload()}>Retry</button>
            </Panel>
          )}
          {!isLive && gameDayPanel}
          {sections.recap && champions.length > 0 && (
            <Panel>
              <div className="section-heading"><h2>Champions</h2></div>
              <div className="compact-list">
                {champions.map((record) => <div className="compact-row" key={record.id}><span>{record.label}</span><strong>{record.championLabel}</strong>{record.score && <small>{record.score}</small>}</div>)}
              </div>
            </Panel>
          )}
          {showHostCard && hostCampaign && (
            <Panel className="home-host-year-callout">
              <div><h2>{hostCampaign.hostClass?.displayName || hostCampaign.title}</h2>{hostCampaign.tagline && <p>{hostCampaign.tagline}</p>}</div>
              <Link to={`/host-year/${hostCampaign.slug}`}>Meet the host class <IconArrowRight size={16} /></Link>
            </Panel>
          )}
          {mode === 'tournament_live' && sections.fundraisers && <Link className="home-host-fundraisers" to="/host-year">Host class fundraisers</Link>}
          {visibleSeasonLinks.length > 0 && (
            <Panel>
              <nav className="hero-actions" aria-label="Season resources">
                {visibleSeasonLinks.map(({ to, label }) => <Link className="btn secondary small" key={to} to={to}>{label}</Link>)}
              </nav>
            </Panel>
          )}
          {sections.coverage && data.latestNews.length > 0 && (
            <Panel>
              <div className="section-heading"><h2>Latest coverage</h2><Link to="/news">News archive</Link></div>
              <div className="compact-list">
                {data.latestNews.map((article) => (
                  <a key={article.id} className="compact-row" href={article.url} target="_blank" rel="noreferrer">
                    <span>{article.source}</span><strong>{article.title}</strong>
                    {article.excerpt && <small>{article.excerpt}</small>}
                  </a>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}

function featuredPollForHome(polls: PredictionPoll[]) {
  return polls.find((poll) => poll.open && poll.pollType === 'game') || polls.find((poll) => poll.open) || polls[0] || null
}

function combineGameDayGames(liveGames: Game[], todayGames: Game[]) {
  const seenGameIds = new Set<string>()

  return [...liveGames, ...todayGames].filter((game) => {
    if (seenGameIds.has(game.id)) return false

    seenGameIds.add(game.id)
    return true
  })
}

function hasHomeGameDayNote(note: GameDayNote | null): note is GameDayNote {
  return Boolean(note?.hostClass || note?.foodMenu || note?.announcement || note?.sponsorShoutout)
}
