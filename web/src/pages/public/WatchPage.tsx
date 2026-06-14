import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime } from '../../lib/datetime'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel } from '../../components/ui'
import { IconExternal, IconPlay } from '../../components/Icons'

export function WatchPage() {
  const { data, loading, error, reload } = useAsync(() => api.publicSchedule({ phase: '' }), [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />

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
        <a className="btn primary" href={import.meta.env.VITE_CLUTCH_URL || 'https://www.clutchguam.com'} target="_blank" rel="noreferrer">Open Clutch <IconExternal /></a>
      </Panel>

      {streamGames.length === 0 ? (
        <EmptyState title="No stream links posted yet" description="Check back closer to tipoff, or open Clutch for the latest available tournament broadcasts." />
      ) : (
        <div className="game-card-grid">
          {streamGames.map((game) => (
            <article key={game.id} className="game-card stream-card">
              <span>{formatGuamDateTime(game.startTime)}</span>
              <h2>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</h2>
              <p>{game.venue || 'Venue TBD'}</p>
              <a className="btn primary" href={game.streamUrl || '#'} target="_blank" rel="noreferrer">Watch stream <IconExternal /></a>
            </article>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <Panel>
          <div className="section-heading"><h2>Games awaiting stream links</h2></div>
          <div className="compact-list">
            {upcoming.map((game) => (
              <div className="compact-row" key={game.id}>
                <span>{formatGuamDateTime(game.startTime)}</span>
                <strong>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</strong>
                <small>{game.venue || 'Venue TBD'}</small>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
