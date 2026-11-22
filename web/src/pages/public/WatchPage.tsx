import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { externalHref } from '../../lib/urls'
import { EmptyState, LoadingState, PageHeader, Panel, SectionUnavailable } from '../../components/ui'
import { IconExternal, IconPlay } from '../../components/Icons'

export function WatchPage() {
  const { data, loading, error, reload } = useAsync(() => api.publicSchedule({ phase: '' }), [])

  const streamGames = (data?.games || []).filter((game) => game.streamUrl)
  const upcoming = (data?.games || []).filter((game) => !game.streamUrl).slice(0, 10)

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Streams and tickets"
        title="Watch live and follow partner links"
        description="Find the confirmed live feed for each game. Stream buttons open Clutch or the organizer-approved platform in a new tab."
      />

      <Panel className="watch-hero">
        <IconPlay size={36} />
        <div>
          <h2>Live links appear as games are confirmed</h2>
          <p>When a stream is ready, the game card below takes you straight to the live broadcast source.</p>
        </div>
        <a className="btn primary" href={externalHref(import.meta.env.VITE_CLUTCH_URL || 'https://www.clutchguam.com') || undefined} target="_blank" rel="noreferrer">Open Clutch <IconExternal /></a>
      </Panel>

      {loading && !data ? (
        <LoadingState label="Loading stream links" />
      ) : error && !data ? (
        <SectionUnavailable
          title="Per-game stream links are unavailable"
          description="Live stream assignments could not be loaded right now. You can still open Clutch directly above."
          onRetry={reload}
        />
      ) : streamGames.length === 0 ? (
        <EmptyState title="No stream links posted yet" description="Check back closer to tipoff, or open Clutch for the latest available tournament broadcasts." />
      ) : (
        <div className="game-card-grid">
          {streamGames.map((game) => (
            <article key={game.id} className="game-card stream-card">
              <span>{formatGuamDateTime(game.startTime)}</span>
              <h2>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</h2>
              <p>{game.venue || DEFAULT_GAME_VENUE}</p>
              <a className="btn primary" href={externalHref(game.streamUrl) || '#'} target="_blank" rel="noreferrer">Watch stream <IconExternal /></a>
            </article>
          ))}
        </div>
      )}

      {!error && upcoming.length > 0 && (
        <Panel>
          <div className="section-heading"><h2>Games awaiting stream links</h2></div>
          <div className="compact-list">
            {upcoming.map((game) => (
              <div className="compact-row" key={game.id}>
                <span>{formatGuamDateTime(game.startTime)}</span>
                <strong>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</strong>
                <small>{game.venue || DEFAULT_GAME_VENUE}</small>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
