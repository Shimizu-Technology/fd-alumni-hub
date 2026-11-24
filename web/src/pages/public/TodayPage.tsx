import { GameBoxScoreButton } from '../../components/GameBoxScoreDrawer'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatGuamDate, formatGuamDateTime, toLocalDateTimeInputValue } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, gameResultLabel } from '../../lib/games'
import { useAsync } from '../../lib/hooks'
import { safeHttpsHref, safePublicImageHref } from '../../lib/urls'
import { readOrCreateVoterToken } from '../../lib/voter'
import type { Game, PredictionPoll, RosterEntry, TonightPayload } from '../../lib/types'
import { EmptyState, LoadingState, PageHeader, Panel, SectionUnavailable, StatusBadge } from '../../components/ui'
import { IconArrowRight, IconExternal } from '../../components/Icons'
import { useSiteMode } from '../../contexts/SiteModeContext'
import { PredictionPollCard } from '../../components/PredictionPollCard'
import { GameNightDates } from '../../components/GameNightDates'
import { PhotoGallery } from '../../components/PhotoGallery'

const todayRefreshIntervalMs = 10_000

export function TodayPage() {
  const { alerts: layoutAlerts } = useSiteMode()
  const [search, setSearch] = useSearchParams()
  const date = search.get('date') || ''
  const year = search.get('year')
  const tournamentId = search.get('tournamentId')
  const changeDate = (date: string) => setSearch((current) => {
    const next = new URLSearchParams(current)
    if (date) next.set('date', date)
    else next.delete('date')
    return next
  })
  const [voterToken] = useState(readOrCreateVoterToken)
  const [pollOverrides, setPollOverrides] = useState<Record<string, PredictionPoll>>({})
  const [voteError, setVoteError] = useState('')
  const { data: result, loading, error, reload } = useAsync(async () => ({
    date, year, tournamentId,
    payload: await api.publicToday({ date, year: year ? Number(year) : null, tournamentId }, voterToken),
  }), [date, year, tournamentId, voterToken])
  const currentSeason = result?.year === year && result?.tournamentId === tournamentId ? result : null
  const data = currentSeason?.date === date ? currentSeason.payload : null
  const today = toLocalDateTimeInputValue(new Date().toISOString()).slice(0, 10)
  const selectedDate = date || data?.date || today

  useEffect(() => {
    setPollOverrides({})
  }, [data])

  useEffect(() => {
    setVoteError('')
  }, [date, tournamentId, year])

  useEffect(() => {
    if (!data) return undefined

    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void reload()
    }, todayRefreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [data, reload])

  const polls = useMemo(() => {
    const base = data?.predictionPolls || []
    return base.map((poll) => pollOverrides[poll.id] || poll)
  }, [data?.predictionPolls, pollOverrides])

  const vote = async (poll: PredictionPoll, teamId: string) => {
    setVoteError('')
    try {
      const result = await api.publicVotePrediction(poll.id, { teamId, voterToken })
      setPollOverrides((current) => ({ ...current, [poll.id]: result.predictionPoll }))
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'Unable to save prediction')
    }
  }

  return (
    <div className="page-stack today-page">
      <PageHeader
        title="Tonight at The Jungle"
        description={data?.date ? `${formatGuamDate(data.date, { weekday: 'long' })} · Guam time` : 'Game-night guide · Guam time'}
        actions={<Link className="btn secondary" to="/schedule">Full schedule <IconArrowRight /></Link>}
      />
      <div className="today-date-nav">
        <GameNightDates dates={currentSeason?.payload.scheduledDates || []} selected={selectedDate} today={today} onSelect={changeDate} />
        <details className="today-other-date">
          <summary>Other date</summary>
          <label>Guam date <input type="date" value={selectedDate} onChange={(event) => changeDate(event.target.value)} /></label>
        </details>
      </div>
      {!data ? (
        error && !loading ? <SectionUnavailable title="The nightly guide is unavailable" onRetry={reload} /> : <LoadingState label="Loading Tonight at The Jungle" />
      ) : (
        <>
          {error && <p role="status">Live refresh failed. Showing the last loaded guide. <button className="btn secondary small" onClick={reload}>Retry</button></p>}
          <TonightGuide data={{ ...data, predictionPolls: polls, alerts: data.alerts?.filter((alert) => !layoutAlerts.some((shown) => shown.id === alert.id)) }} onJump={changeDate} onVote={vote} voteError={voteError} />
        </>
      )}
    </div>
  )
}

export function TonightGuide({ data, onJump, onVote, voteError }: {
  data: TonightPayload
  onJump?: (date: string) => void
  onVote?: (poll: PredictionPoll, teamId: string) => Promise<void>
  voteError?: string
}) {
  const note = data.gameDayNote
  const spotlight = note?.hostSpotlight
  const safePhoto = safePublicImageHref(spotlight?.photoUrl)
  const photos = (note?.photos || []).flatMap((photo) => {
    const url = safePublicImageHref(photo.url)
    return url ? [{ ...photo, url }] : []
  })
  const events = note?.specialEvents || []
  const linked = (data.linkedCampaignEvents || []).filter((event) => !events.some((custom) => custom.campaignEventId === event.id))
  const hostClass = spotlight?.hostClassLabel?.trim() || note?.hostClass?.trim()
  const hasSpotlight = Boolean(hostClass || spotlight?.headline?.trim() || spotlight?.body?.trim() || safePhoto)
  const menu = note?.menuItems || []
  const updates = data.updates || []
  const sponsors = data.sponsors || []
  const hasMenu = Boolean(menu.length || note?.foodMenu?.trim())
  const hasUpdates = Boolean(updates.length || note?.announcement?.trim())
  const hasSponsors = Boolean(sponsors.length || note?.sponsorShoutout?.trim())
  const hasCompanion = hasSpotlight || hasMenu || photos.length > 0 || events.length > 0 || linked.length > 0 || hasUpdates || hasSponsors
  const noNightProgram = !data.games.length && !note && !updates.length && !linked.length
  const hasPrimary = Boolean(data.games.length || data.predictionPolls.length || noNightProgram)

  return (
    <>
      {data.alerts?.map((alert) => (
        <div key={alert.id} className={`tournament-alert-banner tournament-alert-banner--${alert.severity}`} role={alert.severity === 'urgent' ? 'alert' : 'status'}>
          <span className="tournament-alert-pill">{alert.severity}</span>
          <div className="tournament-alert-copy"><strong>{alert.title}</strong><p>{alert.message}</p></div>
        </div>
      ))}
      <div className={hasPrimary && hasCompanion ? 'tonight-guide tonight-guide--split' : 'tonight-guide'}>
        {hasPrimary && <div className="tonight-column">
          {data.games.length > 0 && <Panel className="tonight-scores">
            <h2>Tip-offs &amp; Live Scores</h2>
            <div className="today-game-list">
              {data.games.map((game) => <TodayGameCard key={game.id} game={game} fallbackTicketUrl={data.fallbackTicketUrl || null} />)}
            </div>
          </Panel>}
          {noNightProgram && <EmptyState
            title={data.isRestDay ? 'Rest day at The Jungle' : 'No published games for this night'}
            description={data.isRestDay ? 'There are no games or events on this date.' : undefined}
            action={data.nextScheduledDate && onJump ? (
              <button type="button" className="btn primary" onClick={() => onJump(data.nextScheduledDate!)}>
                Next scheduled night · {formatGuamDate(data.nextScheduledDate, { weekday: 'short', year: undefined })}
              </button>
            ) : undefined}
          />}
          {data.predictionPolls.length > 0 && <Panel>
            <h2>Fan Predictions</h2>
            {voteError && <p className="form-error" role="alert">{voteError}</p>}
            <div className="prediction-grid">{data.predictionPolls.map((poll) => <PredictionPollCard key={poll.id} poll={poll} onVote={onVote} />)}</div>
          </Panel>}
        </div>}

        {hasCompanion && <div className="tonight-column">
          {hasSpotlight && <Panel>
            <h2>Host Class Spotlight</h2>
            {safePhoto && <img className="night-spotlight-photo" src={safePhoto} alt="" loading="lazy" />}
            {hostClass && <p className="tonight-host-class">{hostClass}</p>}
            {spotlight?.headline && <h3>{spotlight.headline}</h3>}
            {spotlight?.body && <p className="night-copy">{spotlight.body}</p>}
          </Panel>}

          {hasMenu && <Panel>
            <h2>Food &amp; Drink Menu</h2>
            {menu.length ? <ul className="today-menu">
              {menu.map((item, index) => <li key={index}>
                <div><strong>{item.name}</strong> {item.price && <span>{item.price}</span>}
                  {item.category && <small>{item.category}</small>}
                  {item.notes && <p>{item.notes}</p>}
                </div>
                <span className={`tournament-alert-pill tournament-alert-pill--${item.available === false ? 'warning' : 'info'}`}>{item.available === false ? 'Sold out' : 'Available'}</span>
              </li>)}
            </ul> : <p className="night-copy">{note?.foodMenu}</p>}
          </Panel>}

          {photos.length > 0 && <Panel>
            <PhotoGallery key={data.date} photos={photos} title="Tonight’s Photos & Flyers" photoLabel="photo or flyer" headingLevel={2} />
          </Panel>}

          {events.length > 0 && <Panel>
            <h2>Special Events &amp; Theme Nights</h2>
            <div className="tonight-entry-list">
              {events.map((event, index) => <article key={index}>
                <h3>{event.campaignEventId ? <Link to={`/fundraisers/${encodeURIComponent(event.campaignEventId)}`}>{event.title}</Link> : event.title}</h3>
                {event.timeLabel && <p className="muted">{event.timeLabel}</p>}
                {event.description && <p className="night-copy">{event.description}</p>}
              </article>)}
            </div>
          </Panel>}

          {hasUpdates && <Panel>
            <h2>Organizer Updates</h2>
            <div className="tonight-entry-list">
              {note?.announcement && <p className="night-copy">{note.announcement}</p>}
              {updates.map((update) => <article key={update.id}>
                <h3>{update.title}</h3>
                <p className="night-copy">{update.body}</p>
              </article>)}
            </div>
          </Panel>}

          {linked.length > 0 && <Panel>
            <h2>Linked Fundraisers</h2>
            <div className="tonight-entry-list">
              {linked.map((event) => <article key={event.id}>
                <h3><Link to={`/fundraisers/${encodeURIComponent(event.id)}`}>{event.title}</Link></h3>
                {(event.startsAt || event.dateLabel) && <p className="muted">{event.startsAt ? formatGuamDateTime(event.startsAt) : event.dateLabel}</p>}
                {event.description && <p className="night-copy">{event.description}</p>}
              </article>)}
            </div>
          </Panel>}

          {hasSponsors && <Panel>
            <h2>Sponsors</h2>
            {note?.sponsorShoutout && <p className="night-copy">{note.sponsorShoutout}</p>}
            {sponsors.length > 0 && <ul className="tonight-sponsors">
              {sponsors.map((sponsor) => {
                const href = safeHttpsHref(sponsor.targetUrl)
                return <li key={sponsor.id}>{href ? <a href={href}>{sponsor.name}</a> : sponsor.name}</li>
              })}
            </ul>}
          </Panel>}
        </div>}
      </div>
    </>
  )
}

function TodayGameCard({
  game,
  fallbackTicketUrl,
}: {
  game: Game
  fallbackTicketUrl: string | null
}) {
  const hasScore = game.homeScore !== null && game.awayScore !== null
  const directTicketHref = safeHttpsHref(game.ticketUrl)
  const effectiveTicketHref = directTicketHref || safeHttpsHref(fallbackTicketUrl)
  const streamHref = safeHttpsHref(game.streamUrl)

  return (
    <article className="today-game-card today-game-card--no-poll">
      <div className="today-game-main">
        <div className="game-card-top">
          <span>{formatGuamDateTime(game.startTime)}</span>
          <StatusBadge status={game.status} />
        </div>
        <h3><TeamNameLink team={game.awayTeam} fallback="Away team" /> at <TeamNameLink team={game.homeTeam} fallback="Home team" /></h3>
        {hasScore && (
          <div className="today-score-strip" aria-label="Game score">
            <span>{game.awayTeam?.displayName || 'Away'}</span>
            <strong>{game.awayScore} – {game.homeScore}</strong>
            <span>{game.homeTeam?.displayName || 'Home'}</span>
          </div>
        )}
        {game.status === 'final' && game.officialWinnerTeamId && <p>{gameResultLabel(game)}</p>}
        {game.status === 'final' && game.resultOutcome === 'overtime' && <p>Overtime</p>}
        {game.statusNote && <p className="game-status-note">{game.statusNote}</p>}
        <p>{game.venue || DEFAULT_GAME_VENUE}</p>
        <div className="game-actions">
          <GameBoxScoreButton game={game} />
          {effectiveTicketHref ? (
            <a className="btn secondary small" href={effectiveTicketHref} target="_blank" rel="noreferrer">
              {directTicketHref ? 'Tickets' : 'Tournament tickets'} <IconExternal />
            </a>
          ) : (
            <span className="link-muted">Tickets pending</span>
          )}
          {streamHref ? (
            <a className="btn primary small" href={streamHref} target="_blank" rel="noreferrer">Stream <IconExternal /></a>
          ) : (
            <span className="link-muted">Stream pending</span>
          )}
        </div>
        <RosterDetails game={game} />
      </div>
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
        <RosterList teamId={game.awayTeam?.id} title={game.awayTeam?.displayName || 'Away team'} entries={awayRoster} />
        <RosterList teamId={game.homeTeam?.id} title={game.homeTeam?.displayName || 'Home team'} entries={homeRoster} />
      </div>
    </details>
  )
}

function TeamNameLink({ team, fallback }: { team?: Game['awayTeam'] | null; fallback: string }) {
  return team ? <Link to={`/teams/${team.id}`}>{team.displayName}</Link> : <>{fallback}</>
}

function RosterList({ teamId, title, entries }: { teamId?: string; title: string; entries: RosterEntry[] }) {
  return <div><h3>{teamId ? <Link to={`/teams/${teamId}`}>{title}</Link> : title}</h3>{entries.length ? <ul>{entries.map((entry) => <li key={entry.id}>{entry.jerseyNumber && <span>#{entry.jerseyNumber}</span>}<strong>{entry.name}</strong>{entry.nickname && <small>“{entry.nickname}”</small>}{entry.position && <small>{entry.position}</small>}</li>)}</ul> : <p className="muted">Roster pending</p>}</div>
}

function activeRoster(entries?: RosterEntry[]) {
  return (entries || []).filter((entry) => entry.active)
}
