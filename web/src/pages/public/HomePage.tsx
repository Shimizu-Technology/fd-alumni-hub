import { FindYourClassCard } from '../../components/FindYourClassCard'
import { LiveScoreboardStrip } from '../../components/LiveScoreboardStrip'
import { HostYearShowcase } from '../../components/HostYearShowcase'
import { SeasonHero } from '../../components/SeasonHero'
import { useSiteMode } from '../../contexts/SiteModeContext'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { graduationYearFor } from '../../lib/history'
import { useAsync } from '../../lib/hooks'
import { readOrCreateVoterToken } from '../../lib/voter'
import { formatGuamDate, formatGuamDateTime, formatGuamTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { staticChampionRecords } from '../../lib/staticChampions'
import { LoadingState, Panel } from '../../components/ui'
import { IconArrowRight } from '../../components/Icons'
import { PredictionPollCard } from '../../components/PredictionPollCard'
import type { SiteSection } from '../../lib/siteMode'
import type { Game, PredictionPoll } from '../../lib/types'

const liveRefreshIntervalMs = 15_000
const offSeasonRefreshIntervalMs = 120_000
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
  const { siteMode: layoutMode, alerts: layoutAlerts, acceptSiteMode } = useSiteMode()
  const { data, loading, error, reload } = useAsync(() => api.publicHome(voterToken), [voterToken])

  useEffect(() => {
    setPollOverrides({})
    if (data) acceptSiteMode(data)
  }, [data, acceptSiteMode])

  const activeMode = data?.siteMode?.mode || layoutMode.mode
  const refreshIntervalMs = activeMode === 'tournament_live' ? liveRefreshIntervalMs : offSeasonRefreshIntervalMs

  useEffect(() => {
    if (!data) return undefined

    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void reload()
    }, refreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [data, reload, refreshIntervalMs])

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
  const tonightGames = (data?.todayGames || []).filter((game) => game.status === 'scheduled' || game.status === 'live').slice(0, 6)
  const gameDayNote = data?.gameDayNote || null
  const hostClass = gameDayNote?.hostSpotlight?.hostClassLabel || gameDayNote?.hostClass || hostCampaign?.hostClass?.displayName
  const menuHeadline = gameDayNote?.menuItems?.find((item) => item.available !== false)?.name || gameDayNote?.foodMenu
  const announcement = gameDayNote?.announcement
  const sponsorShoutout = gameDayNote?.sponsorShoutout
  const hasGameDayNote = Boolean(hostClass || menuHeadline || announcement || sponsorShoutout)
  const activeAlerts = (data ? data.alerts : layoutAlerts)?.filter((item) => item.active) || []
  const showHostCard = sections.fundraisers && (mode === 'schedule_ready' || (mode === 'tournament_recap' && recap.handoffBannerEnabled))
  const leadLinks: SiteSection[] = mode === 'schedule_ready' ? ['schedule', 'teams', 'tickets'] : []
  const visibleSeasonLinks = seasonLinks.filter(({ section }) => sections[section] && !leadLinks.includes(section))
  const isLive = mode === 'tournament_live'
  const champions = (data?.championRecords || []).filter((record) => record.championLabel)

  const gameDayPanel = (data || (isLive && activeAlerts.length > 0)) && (sections.tonight || activeAlerts.length > 0) && (
    <Panel className="home-tonight-panel">
      <div className="section-heading"><h2>Tonight at The Jungle</h2><Link to="/today">Tonight’s guide <IconArrowRight size={15} /></Link></div>
      {activeAlerts.map((alert) => (
        <div key={alert.id} role={alert.severity === 'urgent' ? 'alert' : 'status'}>
          <Link className={`tournament-alert-banner tournament-alert-banner--${alert.severity}`} to="/today">
            <span className={`tournament-alert-pill tournament-alert-pill--${alert.severity}`}>{alert.severity === 'urgent' ? 'Urgent' : 'Alert'}</span>
            <div className="tournament-alert-copy"><strong>{alert.title}</strong><p>{alert.message}</p></div>
          </Link>
        </div>
      ))}
      {sections.tonight && hasGameDayNote && (
        <Link to="/today" className="home-today-note">
          <div className="home-today-note-grid">
            {hostClass && <div><span>Host class</span><strong>{hostClass}</strong></div>}
            {menuHeadline && <div><span>Food / menu</span><strong>{menuHeadline}</strong></div>}
          </div>
          {announcement && <p>{announcement}</p>}
          {sponsorShoutout && <small>{sponsorShoutout}</small>}
        </Link>
      )}
      {sections.tonight && tonightGames.length > 0 && (
        <div className="home-tipoff-grid">
          {tonightGames.map((game) => (
            <Link key={game.id} to="/today" className="home-tipoff">
              <span>{game.status === 'live' ? 'Live' : game.dateOnly ? 'Tip-off TBA' : formatGuamTime(game.startTime)}</span>
              <strong>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</strong>
              <small>{game.venue || DEFAULT_GAME_VENUE}</small>
            </Link>
          ))}
        </div>
      )}
      {sections.tonight && featuredPoll && (
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
    </Panel>
  )

  if (loading && !data) return <LoadingState label="Loading season updates" />

  return (
    <div className="page-stack">
      {mode === 'fundraising' && sections.fundraisers && data?.hostYear ? (
        <HostYearShowcase key={data.hostYear.campaign.id} data={data.hostYear} />
      ) : isLive ? (
        <LiveScoreboardStrip games={scoreboardGames} showEmpty />
      ) : (
        <SeasonHero siteMode={siteMode} tournament={mode === 'fundraising' ? data?.upcomingOrLiveTournament || siteMode.tournament : siteMode.tournament} />
      )}
      {isLive && gameDayPanel}
      {mode === 'schedule_ready' && sections.schedule && (
        <Panel>
          <div className="section-heading"><h2>Upcoming tip-offs</h2><Link to="/schedule">Full schedule <IconArrowRight size={15} /></Link></div>
          {data?.schedulePreview?.length ? (
            <div className="compact-list">
              {data.schedulePreview.map((game) => (
                <Link key={game.id} to="/schedule" className="compact-row">
                  <span>{game.dateOnly ? formatGuamDate(game.startTime) : formatGuamDateTime(game.startTime)}</span>
                  <strong>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</strong>
                  <small>{game.venue || DEFAULT_GAME_VENUE}</small>
                </Link>
              ))}
            </div>
          ) : <p>View the schedule for tournament dates and results.</p>}
        </Panel>
      )}
      {sections.recap && champions.length > 0 && (
        <Panel>
          <div className="section-heading"><h2>Champions</h2></div>
          <div className="compact-list">
            {champions.map((record) => <div className="compact-row" key={record.id}><span>{record.label}</span><strong>{record.championLabel}</strong>{record.score && <small>{record.score}</small>}</div>)}
          </div>
        </Panel>
      )}
      <FindYourClassCard championRecords={data?.championRecords} hostClassYear={graduationYearFor(data?.hostYear?.campaign.hostClass || hostCampaign?.hostClass)} />
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
              <span>Refresh failed. Showing the last loaded updates.</span>{' '}
              <button type="button" className="btn secondary small" onClick={() => void reload()}>Retry</button>
            </Panel>
          )}
          {showHostCard && hostCampaign && (
            <Panel className="home-host-year-callout">
              <div><h2>{hostCampaign.hostClass?.displayName || hostCampaign.title}</h2>{hostCampaign.tagline && <p>{hostCampaign.tagline}</p>}</div>
              <Link to={`/host-year/${hostCampaign.slug}`}>{mode === 'schedule_ready' ? 'Explore fundraisers' : 'Meet the host class'} <IconArrowRight size={16} /></Link>
            </Panel>
          )}
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
