import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { representedClassesLabel } from '../../lib/classes'
import { formatGuamDate, formatGuamDateTime, guamDayLabel } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, formatTournamentWindow, gameResultLabel } from '../../lib/games'
import { classRouteKey } from '../../lib/history'
import { useAsync } from '../../lib/hooks'
import type { Article, Game, MediaAsset, Sponsor, Standing, TournamentChampion } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui'
import { IconArrowRight, IconExternal } from '../../components/Icons'

export function HistoryDetailPage() {
  const { year = '' } = useParams()
  const numericYear = parseArchiveYear(year)
  const { data, loading, error, reload } = useAsync(async () => {
    if (!numericYear) throw new Error('Choose a valid tournament year')

    const [championsResult, scheduleResult, standingsResult, articlesResult, mediaResult, sponsorsResult] = await Promise.allSettled([
      api.publicChampions({ year: numericYear }),
      api.publicSchedule({ year: numericYear }),
      api.publicStandings({ year: numericYear }),
      api.publicArticles({ year: numericYear, limit: 200 }),
      api.publicMedia({ year: numericYear, limit: 200 }),
      api.publicSponsors({ year: numericYear }),
    ])

    return {
      year: numericYear,
      champions: settledValue(championsResult, emptyChampionsArchive()),
      schedule: settledValue(scheduleResult, emptyScheduleArchive()),
      standings: settledValue(standingsResult, emptyStandingsArchive()),
      articles: settledValue(articlesResult, emptyArticlesArchive()),
      media: settledValue(mediaResult, emptyMediaArchive()),
      sponsors: settledValue(sponsorsResult, emptySponsorsArchive()),
    }
  }, [numericYear])

  const archiveData = data?.year === numericYear ? data : null

  if (loading && !archiveData) return <LoadingState label="Loading tournament archive" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = archiveData?.schedule.tournament || archiveData?.standings.tournament || archiveData?.articles.tournament || archiveData?.media.tournament || archiveData?.sponsors.tournament || null
  const games = archiveData?.schedule.games || []
  const articles = archiveData?.articles.articles || []
  const mediaAssets = archiveData?.media.mediaAssets || []
  const sponsors = archiveData?.sponsors.sponsors || []
  const standings = archiveData?.standings.standings || []
  const scoreCoverage = archiveData?.standings.scoreCoverage
  const finalGames = games.filter((game) => game.status === 'final' && game.homeScore !== null && game.awayScore !== null)
  const championRecords = archiveData?.champions.championRecords || []
  const primaryChampion = championRecords.find((record) => record.status === 'completed') || championRecords[0]

  return (
    <div className="page-stack archive-detail-page">
      <PageHeader
        eyebrow="Tournament archive"
        title={`${numericYear || year} FD Alumni Basketball`}
        description={tournament ? `${formatTournamentWindow(tournament)} · ${archiveDescription(primaryChampion)}` : archiveDescription(primaryChampion)}
        actions={<Link className="btn secondary" to="/history">Back to history <IconArrowRight /></Link>}
      />

      <section className="archive-hero panel">
        <div>
          <span className="archive-kicker">Archive snapshot</span>
          <h2>{championRecords.length > 1 ? `${numericYear} champion editions` : primaryChampion?.championLabel || 'Champion research pending'}</h2>
          <p>{championSummary(primaryChampion)}</p>
          <div className="archive-badges">
            <StatusBadge status={primaryChampion?.status || tournament?.status || 'research-pending'} />
            <span>{primaryChampion?.score ? `Final: ${primaryChampion.score}` : 'Final score pending'}</span>
            <span>{primaryChampion?.source || 'Source pending'}</span>
          </div>
        </div>
        <img src="/brand/fd-crest.png" alt="" aria-hidden="true" />
      </section>

      {championRecords.length > 0 && <ChampionRecordsPanel records={championRecords} />}

      <div className="stats-grid four">
        <StatCard label="Games tracked" value={games.length} tone="maroon" />
        <StatCard label="Final scores" value={finalGames.length} detail={scoreCoverage ? `${scoreCoverage.percent}% coverage` : 'Coverage pending'} />
        <StatCard label="Articles" value={articles.length} tone="gold" />
        <StatCard label="Photos" value={mediaAssets.length} />
      </div>

      <section className="split-grid archive-split">
        <Panel>
          <div className="section-heading"><h2>Results and schedule</h2><span>{games.length} games</span></div>
          {!games.length ? <EmptyState title="Schedule archive pending" description="Games for this tournament have not been loaded into the Rails archive yet." /> : <ArchiveGameList games={games} />}
        </Panel>
        <Panel>
          <div className="section-heading"><h2>Standings snapshot</h2><span>{visibleCountLabel(standings.length, Math.min(standings.length, 12), 'teams')}</span></div>
          {!standings.length ? <EmptyState title="Standings pending" description="Standings appear here when verified results are available for this tournament." /> : <ArchiveStandings standings={standings} />}
        </Panel>
      </section>

      <ArchiveArticles articles={articles} />
      <ArchiveMedia mediaAssets={mediaAssets} />
      <ArchiveSponsors sponsors={sponsors} />
    </div>
  )
}

type ChampionsArchive = Awaited<ReturnType<typeof api.publicChampions>>
type ScheduleArchive = Awaited<ReturnType<typeof api.publicSchedule>>
type StandingsArchive = Awaited<ReturnType<typeof api.publicStandings>>
type ArticlesArchive = Awaited<ReturnType<typeof api.publicArticles>>
type MediaArchive = Awaited<ReturnType<typeof api.publicMedia>>
type SponsorsArchive = Awaited<ReturnType<typeof api.publicSponsors>>

function parseArchiveYear(value: string) {
  if (!/^\d{4}$/.test(value)) return null

  const parsed = Number(value)
  return parsed >= 1900 && parsed <= 2200 ? parsed : null
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === 'fulfilled' ? result.value : fallback
}

function visibleCountLabel(total: number, visible: number, noun?: string) {
  const suffix = noun ? ` ${noun}` : ''
  return total > visible ? `${visible} of ${total}${suffix}` : `${total}${suffix}`
}

function emptyChampionsArchive(): ChampionsArchive {
  return { championRecords: [], titleCounts: [], entryTitleCounts: [] }
}

function emptyScheduleArchive(): ScheduleArchive {
  return { tournament: null, games: [], teams: [], divisions: [], phases: [] }
}

function emptyStandingsArchive(): StandingsArchive {
  return { tournament: null, standings: [], divisions: [], scoreCoverage: { scoredGames: 0, totalGames: 0, percent: 0 } }
}

function emptyArticlesArchive(): ArticlesArchive {
  return { tournament: null, articles: [] }
}

function emptyMediaArchive(): MediaArchive {
  return { tournament: null, mediaAssets: [] }
}

function emptySponsorsArchive(): SponsorsArchive {
  return { tournament: null, sponsors: [] }
}

function archiveDescription(record: TournamentChampion | undefined) {
  if (!record) return 'Known games, scores, photos, and coverage from this tournament year.'
  if (record.status === 'cancelled') return record.notes || 'Tournament cancelled.'
  if (record.championLabel) return `${record.championLabel} title record with source links and available tournament media.`
  return record.notes || 'Historical details are still being researched.'
}

function championSummary(record: TournamentChampion | undefined) {
  if (!record) return 'This tournament archive is still being filled in from available source material.'
  if (record.status === 'cancelled') return record.notes || 'Tournament cancelled.'
  if (record.runnerUpLabel) return `Champion: ${record.championLabel}. Runner-up: ${record.runnerUpLabel}.`
  return record.notes || `Champion: ${record.championLabel}.`
}

function ChampionRecordsPanel({ records }: { records: TournamentChampion[] }) {
  return (
    <Panel>
      <div className="section-heading"><h2>Champion record</h2><span>{records.length} {records.length === 1 ? 'edition' : 'editions'}</span></div>
      <div className="champion-record-grid">
        {records.map((record) => (
          <article className="champion-record-card" key={record.id}>
            <span>{record.label}</span>
            {record.championKey && record.championLabel ? <Link to={`/classes/${classRouteKey(record.championKey)}`}><strong>{record.championLabel}</strong></Link> : <strong>{record.championLabel || 'Champion pending'}</strong>}
            <p>{record.runnerUpLabel ? `Runner-up: ${record.runnerUpLabel}` : record.notes || record.source}</p>
            <small>{record.score ? `${record.score} · ` : ''}{record.source}</small>
          </article>
        ))}
      </div>
    </Panel>
  )
}

function ArchiveGameList({ games }: { games: Game[] }) {
  const groups = new Map<string, Game[]>()
  games.forEach((game) => {
    const day = guamDayLabel(game.startTime)
    groups.set(day, [...(groups.get(day) || []), game])
  })

  return <div className="archive-game-list">{Array.from(groups.entries()).map(([day, dayGames]) => <div key={day}><h3>{day}</h3>{dayGames.map((game) => <ArchiveGameRow key={game.id} game={game} />)}</div>)}</div>
}

function ArchiveGameRow({ game }: { game: Game }) {
  const result = gameResultLabel(game)
  const scoreReady = game.homeScore !== null && game.awayScore !== null

  return (
    <article className="archive-game-row">
      <div>
        <strong><TeamNameLink team={game.awayTeam} fallback="Away team" /> at <TeamNameLink team={game.homeTeam} fallback="Home team" /></strong>
        <span>{formatGuamDateTime(game.startTime)} · {game.venue || DEFAULT_GAME_VENUE}</span>
        {result && <small>{result}</small>}
      </div>
      <div className="archive-score">{scoreReady ? `${game.awayScore}–${game.homeScore}` : 'Score pending'}</div>
    </article>
  )
}

function TeamNameLink({ team, fallback }: { team?: Game['awayTeam'] | null; fallback: string }) {
  return team ? <Link to={`/teams/${team.id}`}>{team.displayName}</Link> : <>{fallback}</>
}

function ArchiveStandings({ standings }: { standings: Standing[] }) {
  return (
    <div className="table-wrap compact-table-wrap">
      <table className="data-table archive-standings-table">
        <thead><tr><th>Team</th><th>W</th><th>L</th><th>Diff</th></tr></thead>
        <tbody>{standings.slice(0, 12).map((standing) => <tr key={standing.id}><td><strong><Link to={`/teams/${standing.team.id}`}>{standing.team.displayName}</Link></strong><small>{standing.team.division || 'Division pending'} · {representedClassesLabel(standing.team)}</small></td><td>{standing.wins}</td><td>{standing.losses}</td><td>{standing.pointDifferential > 0 ? `+${standing.pointDifferential}` : standing.pointDifferential}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function ArchiveArticles({ articles }: { articles: Article[] }) {
  const visibleArticles = articles.slice(0, 9)

  return (
    <Panel>
      <div className="section-heading"><h2>Coverage from this tournament</h2><span>{visibleCountLabel(articles.length, visibleArticles.length)}</span></div>
      {!articles.length ? <EmptyState title="Coverage pending" description="Articles and recaps will appear here as the archive is verified." /> : (
        <div className="archive-card-grid">
          {visibleArticles.map((article) => (
            <a key={article.id} className="archive-link-card" href={article.url} target="_blank" rel="noreferrer">
              <span>{article.source}{article.publishedAt ? ` · ${formatGuamDate(article.publishedAt)}` : ''}</span>
              <strong>{article.title}</strong>
              {article.excerpt && <p>{article.excerpt}</p>}
              <small>Read source <IconExternal /></small>
            </a>
          ))}
        </div>
      )}
    </Panel>
  )
}

function ArchiveMedia({ mediaAssets }: { mediaAssets: MediaAsset[] }) {
  const visibleMedia = mediaAssets.slice(0, 8)

  return (
    <Panel>
      <div className="section-heading"><h2>Photos and media</h2><span>{visibleCountLabel(mediaAssets.length, visibleMedia.length)}</span></div>
      {!mediaAssets.length ? <EmptyState title="Media pending" description="Photos will appear here when this tournament's media archive is available." /> : (
        <div className="archive-media-strip">
          {visibleMedia.map((asset) => <article key={asset.id}><img src={asset.imageUrl} alt={asset.caption || asset.title} loading="lazy" /><div><strong>{asset.title}</strong><span>{asset.source}</span></div></article>)}
        </div>
      )}
    </Panel>
  )
}

function ArchiveSponsors({ sponsors }: { sponsors: Sponsor[] }) {
  if (!sponsors.length) return null

  return (
    <Panel>
      <div className="section-heading"><h2>Sponsors</h2><span>{sponsors.length}</span></div>
      <div className="archive-sponsor-list">
        {sponsors.map((sponsor) => <ArchiveSponsorBadge key={sponsor.id} sponsor={sponsor} />)}
      </div>
    </Panel>
  )
}

function ArchiveSponsorBadge({ sponsor }: { sponsor: Sponsor }) {
  const content = <><span className="archive-sponsor-logo">{sponsor.logoUrl ? <img src={sponsor.logoUrl} alt="" loading="lazy" /> : sponsor.name.slice(0, 2)}</span><strong>{sponsor.name}</strong></>

  if (sponsor.targetUrl) {
    return <a href={sponsor.targetUrl} target="_blank" rel="noreferrer">{content}</a>
  }

  return <span className="archive-sponsor-badge">{content}</span>
}
