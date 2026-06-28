import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { tournamentScopedPath } from '../../lib/admin'
import { formatTournamentWindow } from '../../lib/games'
import { formatGuamDateTime } from '../../lib/datetime'
import type { Article, Game, MediaAsset, Sponsor, Standing, Team, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui'

type TournamentDashboardData = {
  tournament: Tournament
  teams: Team[]
  games: Game[]
  standings: Standing[]
  articles: Article[]
  mediaAssets: MediaAsset[]
  sponsors: Sponsor[]
}

export function AdminTournamentDetailPage() {
  const { tournamentId } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    if (!tournamentId) throw new Error('Tournament id is missing')

    const [tournamentResult, teams, games, standings, articles, media, sponsors] = await Promise.all([
      api.adminTournament(tournamentId),
      api.adminTeams(tournamentId),
      api.adminGames(tournamentId),
      api.adminStandings(tournamentId),
      api.adminArticles(tournamentId),
      api.adminMedia(tournamentId),
      api.adminSponsors(tournamentId),
    ])

    return {
      tournament: tournamentResult.tournament,
      teams: teams.teams,
      games: games.games,
      standings: standings.standings,
      articles: articles.articles,
      mediaAssets: media.mediaAssets,
      sponsors: sponsors.sponsors,
    } satisfies TournamentDashboardData
  }, [tournamentId])

  if (loading && !data) return <LoadingState label="Loading tournament dashboard" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <EmptyState title="Tournament dashboard unavailable" />

  return <TournamentDashboard data={data} />
}

function TournamentDashboard({ data }: { data: TournamentDashboardData }) {
  const { tournament, teams, games, standings, articles, mediaAssets, sponsors } = data
  const mode = tournament.status === 'completed' || tournament.status === 'cancelled' ? 'archive' : 'operations'
  const metrics = tournamentMetrics(games, teams, standings, articles, mediaAssets, sponsors)
  const nextGame = nextUpcomingGame(games)
  const lastFinal = latestFinalGame(games)

  return (
    <div className="page-stack admin-page tournament-dashboard-page">
      <PageHeader
        eyebrow={`${tournament.year} workspace`}
        title={mode === 'archive' ? 'Tournament archive dashboard' : 'Tournament operations dashboard'}
        description={mode === 'archive'
          ? 'Review the completed tournament record: results, standings, coverage, photos, and public archive readiness.'
          : 'Run the active tournament from one place: setup, schedule, game-day links, scores, coverage, media, and sponsors.'}
        actions={<Link className="btn secondary" to="/admin/tournaments">All tournaments</Link>}
      />

      <Panel className={`tournament-dashboard-hero ${mode === 'archive' ? 'archive-mode' : 'operations-mode'}`}>
        <div>
          <span className="team-card-kicker">{mode === 'archive' ? 'Archive record' : 'Live workspace'}</span>
          <h2>{tournament.year} · {tournament.name}</h2>
          <p>{formatTournamentWindow(tournament)}</p>
        </div>
        <div className="tournament-dashboard-hero-actions">
          <StatusBadge status={tournament.status} />
          <Link className="btn primary" to={mode === 'archive' ? `/history/${tournament.year}` : `/schedule?year=${tournament.year}`}>{mode === 'archive' ? 'View public archive' : 'View public schedule'}</Link>
        </div>
      </Panel>

      <div className="stats-grid four">
        <StatCard label="Teams" value={teams.length} tone="maroon" />
        <StatCard label="Games" value={games.length} detail={`${metrics.finalGames} final`} />
        <StatCard label="Coverage" value={articles.length} detail={`${mediaAssets.length} media assets`} tone="gold" />
        <StatCard label="Sponsors" value={sponsors.length} detail={`${sponsors.filter((sponsor) => sponsor.active).length} active`} />
      </div>

      <div className="split-grid tournament-dashboard-split">
        <Panel>
          <div className="section-heading"><h2>{mode === 'archive' ? 'Archive health' : 'Operations health'}</h2><span>{metrics.healthLabel}</span></div>
          <div className="health-grid tournament-health-grid">
            <div><strong>{metrics.scoredGames}</strong><span>Scored games</span></div>
            <div><strong>{metrics.missingTickets}</strong><span>Missing ticket links</span></div>
            <div><strong>{metrics.missingStreams}</strong><span>Missing stream links</span></div>
          </div>
        </Panel>
        <Panel>
          <div className="section-heading"><h2>{mode === 'archive' ? 'Last recorded game' : 'Next scheduled game'}</h2><span>{games.length} games</span></div>
          {mode === 'archive'
            ? <FeaturedGame game={lastFinal} emptyTitle="No final game recorded" />
            : <FeaturedGame game={nextGame} emptyTitle="No upcoming game found" />}
        </Panel>
      </div>

      <Panel>
        <div className="section-heading"><h2>{mode === 'archive' ? 'Archive workboard' : 'Setup workboard'}</h2><span>Per tournament</span></div>
        <div className="tournament-workboard-grid">
          {(mode === 'archive' ? archiveWorkItems(data, metrics) : operationsWorkItems(data, metrics)).map((item) => <WorkboardCard key={item.title} item={item} />)}
        </div>
      </Panel>

      <div className="split-grid tournament-dashboard-split">
        <Panel>
          <div className="section-heading"><h2>Recent coverage</h2><Link to={tournamentScopedPath('/admin/news', tournament.id)}>Manage</Link></div>
          {articles.length === 0 ? <EmptyState title="No articles" description="Add or import coverage links for this tournament." /> : (
            <div className="compact-list">
              {articles.slice(0, 5).map((article) => <a key={article.id} className="compact-row" href={article.url} target="_blank" rel="noreferrer"><span>{article.source}</span><strong>{article.title}</strong></a>)}
            </div>
          )}
        </Panel>
        <Panel>
          <div className="section-heading"><h2>Media archive</h2><Link to={tournamentScopedPath('/admin/media', tournament.id)}>Manage</Link></div>
          {mediaAssets.length === 0 ? <EmptyState title="No media" description="Attach photos or imported media for this tournament." /> : (
            <div className="tournament-media-preview">
              {mediaAssets.slice(0, 6).map((asset) => (
                <a key={asset.id} href={asset.articleUrl || asset.imageUrl} target="_blank" rel="noreferrer" title={asset.title}>
                  <img src={asset.imageUrl} alt="" loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function FeaturedGame({ game, emptyTitle }: { game: Game | null; emptyTitle: string }) {
  if (!game) return <EmptyState title={emptyTitle} />

  return (
    <div className="featured-game-card">
      <strong>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</strong>
      <span>{formatGuamDateTime(game.startTime)} · {game.venue || 'Venue TBD'}</span>
      {game.status === 'final' && game.homeScore !== null && game.awayScore !== null ? <p>{game.awayScore}–{game.homeScore}</p> : <p>{game.status}</p>}
    </div>
  )
}

type WorkboardItem = {
  title: string
  eyebrow: string
  detail: string
  href: string
  cta: string
  tone?: 'ready' | 'attention' | 'neutral'
}

function WorkboardCard({ item }: { item: WorkboardItem }) {
  return (
    <Link className={`workboard-card workboard-card-${item.tone || 'neutral'}`} to={item.href}>
      <span>{item.eyebrow}</span>
      <strong>{item.title}</strong>
      <p>{item.detail}</p>
      <small>{item.cta}</small>
    </Link>
  )
}

function operationsWorkItems(data: TournamentDashboardData, metrics: ReturnType<typeof tournamentMetrics>): WorkboardItem[] {
  const { tournament, teams, games, articles, mediaAssets, sponsors } = data

  return [
    {
      eyebrow: `${teams.length} teams`,
      title: 'Teams and divisions',
      detail: teams.length ? 'Roster and division setup is available for organizer updates.' : 'Start here before building games.',
      href: tournamentScopedPath('/admin/divisions', tournament.id),
      cta: teams.length ? 'Manage teams' : 'Set up teams',
      tone: teams.length ? 'ready' : 'attention',
    },
    {
      eyebrow: `${games.length} games`,
      title: 'Schedule and scores',
      detail: `${metrics.finalGames} final games. Use this workspace for schedule changes and score entry.`,
      href: tournamentScopedPath('/admin/games', tournament.id),
      cta: games.length ? 'Open games' : 'Build schedule',
      tone: games.length ? 'ready' : 'attention',
    },
    {
      eyebrow: `${metrics.missingTickets + metrics.missingStreams} gaps`,
      title: 'Tickets and streams',
      detail: `${metrics.missingTickets} ticket links and ${metrics.missingStreams} stream links still need attention.`,
      href: tournamentScopedPath('/admin/links', tournament.id),
      cta: 'Review links',
      tone: metrics.missingTickets || metrics.missingStreams ? 'attention' : 'ready',
    },
    {
      eyebrow: `${articles.length} articles · ${mediaAssets.length} media`,
      title: 'Coverage archive',
      detail: 'Keep GSPN, GuamPDN, Clutch, and partner coverage connected to the tournament year.',
      href: tournamentScopedPath('/admin/news', tournament.id),
      cta: 'Manage coverage',
      tone: articles.length || mediaAssets.length ? 'ready' : 'neutral',
    },
    {
      eyebrow: `${sponsors.length} sponsors`,
      title: 'Sponsors',
      detail: 'Maintain sponsor visibility for the selected tournament.',
      href: tournamentScopedPath('/admin/sponsors', tournament.id),
      cta: 'Manage sponsors',
      tone: sponsors.length ? 'ready' : 'neutral',
    },
  ]
}

function archiveWorkItems(data: TournamentDashboardData, metrics: ReturnType<typeof tournamentMetrics>): WorkboardItem[] {
  const { tournament, games, standings, articles, mediaAssets, sponsors } = data

  return [
    {
      eyebrow: `${metrics.scoredGames}/${games.length} scored`,
      title: 'Results archive',
      detail: 'Review final scores and the public schedule record for this historical year.',
      href: tournamentScopedPath('/admin/games', tournament.id),
      cta: 'Review results',
      tone: games.length && metrics.scoredGames === games.length ? 'ready' : 'neutral',
    },
    {
      eyebrow: `${standings.length} rows`,
      title: 'Standings snapshot',
      detail: 'Confirm the final table and point totals imported cleanly.',
      href: tournamentScopedPath('/admin/standings', tournament.id),
      cta: 'Open standings',
      tone: standings.length ? 'ready' : 'neutral',
    },
    {
      eyebrow: `${articles.length} links`,
      title: 'Coverage record',
      detail: 'Preserve source links and article metadata for fans reviewing older tournaments.',
      href: tournamentScopedPath('/admin/news', tournament.id),
      cta: 'Review coverage',
      tone: articles.length ? 'ready' : 'attention',
    },
    {
      eyebrow: `${mediaAssets.length} assets`,
      title: 'Photo and media archive',
      detail: 'Check imported images and media references for the public gallery.',
      href: tournamentScopedPath('/admin/media', tournament.id),
      cta: 'Review media',
      tone: mediaAssets.length ? 'ready' : 'neutral',
    },
    {
      eyebrow: `${sponsors.length} sponsors`,
      title: 'Sponsor record',
      detail: 'Keep sponsor information attached to the year when available.',
      href: tournamentScopedPath('/admin/sponsors', tournament.id),
      cta: 'Review sponsors',
      tone: sponsors.length ? 'ready' : 'neutral',
    },
  ]
}

function tournamentMetrics(games: Game[], teams: Team[], standings: Standing[], articles: Article[], mediaAssets: MediaAsset[], sponsors: Sponsor[]) {
  const finalGames = games.filter((game) => game.status === 'final').length
  const scoredGames = games.filter((game) => game.homeScore !== null && game.awayScore !== null).length
  const missingTickets = games.filter((game) => game.status !== 'final' && !game.ticketUrl).length
  const missingStreams = games.filter((game) => game.status !== 'final' && !game.streamUrl).length
  const totalRecords = teams.length + standings.length + articles.length + mediaAssets.length + sponsors.length

  return {
    finalGames,
    scoredGames,
    missingTickets,
    missingStreams,
    healthLabel: totalRecords > 0 ? `${totalRecords} records` : 'Needs data',
  }
}

function nextUpcomingGame(games: Game[]) {
  const now = Date.now()
  return games
    .filter((game) => game.status !== 'final' && new Date(game.startTime).getTime() >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] || null
}

function latestFinalGame(games: Game[]) {
  return games
    .filter((game) => game.status === 'final')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0] || null
}
