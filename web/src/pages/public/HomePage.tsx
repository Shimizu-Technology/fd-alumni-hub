import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, formatTournamentWindow } from '../../lib/games'
import { EmptyState, ErrorState, LoadingState, Panel, StatCard } from '../../components/ui'
import { IconArrowRight, IconCalendar, IconPlay, IconTrophy } from '../../components/Icons'

export function HomePage() {
  const { data, loading, error, reload } = useAsync(() => api.publicHome(), [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <EmptyState title="Tournament data unavailable" />

  const tournamentLabel = data.tournament ? `${data.tournament.name} ${data.tournament.year}` : 'FD Alumni Tournament Hub'
  const featuredGames = [...data.liveGames, ...data.todayGames].slice(0, 6)
  const heroTournament = data.upcomingOrLiveTournament || data.tournament
  const heroStatus = heroTournament ? `${heroTournament.year} · ${heroTournament.status}` : 'Schedule pending'
  const heroDates = heroTournament ? formatTournamentWindow(heroTournament) : 'Dates will appear once organizers publish them.'

  return (
    <div className="page-stack">
      <section className="hero-card public-hero-card">
        <div className="hero-text">
          <div className="hero-brand-lockup">
            <img src="/brand/fd-logo-banner.png" alt="Father Dueñas Memorial School" />
          </div>
          <p className="eyebrow">Central hub · FD Alumni Basketball</p>
          <h1>Every game night, score, stream, and story from The Jungle.</h1>
          <p>{tournamentLabel}. Built for alumni, families, and fans to follow the tournament while routing tickets, streams, and coverage to the right partners.</p>
          <div className="hero-actions">
            <Link className="btn primary" to="/schedule"><IconCalendar /> View schedule <IconArrowRight /></Link>
            <Link className="btn secondary" to="/standings"><IconTrophy /> Standings</Link>
            <Link className="btn secondary" to="/watch"><IconPlay /> Watch</Link>
          </div>
        </div>
        <div className="hero-panel">
          <img src="/brand/fd-crest.png" alt="" aria-hidden="true" />
          <span>Active tournament</span>
          <strong>{heroStatus}</strong>
          <small>{heroDates}</small>
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
            <EmptyState title="No games scheduled for today" description="Check the full schedule for upcoming matchups, ticket links, and stream links." />
          ) : (
            <div className="compact-list">
              {featuredGames.map((game) => (
                <Link key={game.id} to="/schedule" className="compact-row">
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
        <a href={import.meta.env.VITE_GUAMTIME_URL || 'https://guamtime.net'} target="_blank" rel="noreferrer">
          <span>Tickets</span>
          <strong>Buy through GuamTime when game tickets are available.</strong>
        </a>
        <a href={import.meta.env.VITE_CLUTCH_URL || 'https://www.clutchguam.com'} target="_blank" rel="noreferrer">
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
