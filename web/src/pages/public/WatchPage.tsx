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
        description="This hub lists approved stream destinations when they are available. Viewers continue to watch through Clutch or the organizer-approved platform."
      />

      <Panel className="watch-hero">
        <IconPlay size={36} />
        <div>
          <h2>Stream links appear per game</h2>
          <p>Operators can paste Clutch or partner stream URLs in admin. Public cards then route viewers directly to the source.</p>
        </div>
        <a className="btn primary" href={import.meta.env.VITE_CLUTCH_URL || 'https://www.clutchguam.com'} target="_blank" rel="noreferrer">Open Clutch <IconExternal /></a>
      </Panel>

      {streamGames.length === 0 ? (
        <EmptyState title="No stream links loaded yet" description="Once approved stream URLs are attached to games, they will appear here automatically." />
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
          <div className="section-heading"><h2>Upcoming games awaiting stream links</h2></div>
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
