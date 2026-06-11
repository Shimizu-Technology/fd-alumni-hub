import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime } from '../../lib/datetime'
import { EmptyState, ErrorState, LoadingState, Panel, StatCard } from '../../components/ui'
import { IconArrowRight, IconCalendar, IconPlay, IconTrophy } from '../../components/Icons'

export function HomePage() {
  const { data, loading, error, reload } = useAsync(() => api.publicHome(), [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <EmptyState title="Tournament data unavailable" />

  const tournamentLabel = data.tournament ? `${data.tournament.name} ${data.tournament.year}` : 'FD Alumni Tournament Hub'
  const featuredGames = [...data.liveGames, ...data.todayGames].slice(0, 6)

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-text">
          <p className="eyebrow">Central hub · FD Alumni Basketball</p>
          <h1>Schedule, standings, streams, tickets, and tournament history in one place.</h1>
          <p>{tournamentLabel}. Built to guide alumni and fans to the right partner destinations while keeping tournament context clear.</p>
          <div className="hero-actions">
            <Link className="btn primary" to="/schedule"><IconCalendar /> View schedule <IconArrowRight /></Link>
            <Link className="btn ghost" to="/standings"><IconTrophy /> Standings</Link>
            <Link className="btn ghost" to="/watch"><IconPlay /> Watch</Link>
          </div>
        </div>
        <div className="hero-panel">
          <span>Active tournament</span>
          <strong>{data.upcomingOrLiveTournament ? `${data.upcomingOrLiveTournament.year} ${data.upcomingOrLiveTournament.status}` : 'Awaiting 2026 schedule'}</strong>
          <small>2026 dates shared by organizers: July 3–24.</small>
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
          <div className="section-heading"><h2>Today and live</h2><Link to="/schedule">Full schedule</Link></div>
          {featuredGames.length === 0 ? (
            <EmptyState title="No games listed for today" description="The schedule will populate once tournament data is loaded into Rails." />
          ) : (
            <div className="compact-list">
              {featuredGames.map((game) => (
                <Link key={game.id} to="/schedule" className="compact-row">
                  <span>{formatGuamDateTime(game.startTime)}</span>
                  <strong>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</strong>
                  <small>{game.venue || 'Venue TBD'}</small>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="section-heading"><h2>Latest coverage</h2><Link to="/news">News archive</Link></div>
          {data.latestNews.length === 0 ? (
            <EmptyState title="Coverage links coming soon" description="GSPN and partner links can be managed from the admin console." />
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
        <div>
          <span>Tickets</span>
          <strong>Route fans to GuamTime when ticket links are available.</strong>
        </div>
        <div>
          <span>Streams</span>
          <strong>Send viewers to Clutch and other approved stream partners.</strong>
        </div>
        <div>
          <span>Coverage</span>
          <strong>Preserve GSPN and local media history as linked source material.</strong>
        </div>
      </section>
    </div>
  )
}
