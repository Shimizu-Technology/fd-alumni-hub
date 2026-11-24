import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { representedClassesLabel } from '../../lib/classes'
import { formatGuamDate, formatGuamDateTime, guamDayLabel } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, formatTournamentWindow, gameResultLabel } from '../../lib/games'
import { classRouteKey, publicSourceLabel } from '../../lib/history'
import { useAsync } from '../../lib/hooks'
import { staticChampionsForYear } from '../../lib/staticChampions'
import type { Article, Game, MediaAsset, Sponsor, Standing, TournamentChampion } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, SectionUnavailable, StatCard, StatusBadge } from '../../components/ui'
import { ArticleBadges, DivisionPill } from '../../components/ArchiveBadges'
import { ArchiveChampionDetails } from '../../components/ArchiveChampionDetails'
import { VideoEmbedCard } from '../../components/VideoEmbedCard'
import { safeHttpsHref } from '../../lib/urls'
import { IconArrowRight, IconExternal } from '../../components/Icons'

export function HistoryDetailPage() {
  const { hash } = useLocation()
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

    const staticChampions = staticChampionsForYear(numericYear)
    const championsFailed = championsResult.status === 'rejected'

    return {
      year: numericYear,
      champions: championsFailed
        ? { championRecords: staticChampions, titleCounts: [], entryTitleCounts: [] }
        : championsResult.value,
      schedule: settledValue(scheduleResult, emptyScheduleArchive()),
      standings: settledValue(standingsResult, emptyStandingsArchive()),
      articles: settledValue(articlesResult, emptyArticlesArchive()),
      media: settledValue(mediaResult, emptyMediaArchive()),
      sponsors: settledValue(sponsorsResult, emptySponsorsArchive()),
      failedSections: {
        champions: championsFailed,
        schedule: scheduleResult.status === 'rejected',
        standings: standingsResult.status === 'rejected',
        articles: articlesResult.status === 'rejected',
        media: mediaResult.status === 'rejected',
        sponsors: sponsorsResult.status === 'rejected',
      },
    }
  }, [numericYear])

  const archiveData = data?.year === numericYear ? data : null

  useEffect(() => {
    if (archiveData && hash.startsWith('#archive-video-')) {
      document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
    }
  }, [archiveData, hash])

  if (loading && !archiveData) return <LoadingState label="Loading tournament archive" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = archiveData?.schedule.tournament || archiveData?.standings.tournament || archiveData?.articles.tournament || archiveData?.media.tournament || archiveData?.sponsors.tournament || null
  const games = archiveData?.schedule.games || []
  const articles = archiveData?.articles.articles || []
  const mediaAssets = archiveData?.media.mediaAssets || []
  const videos = mediaAssets.filter((asset) => asset.mediaType === 'video')
  const photos = mediaAssets.filter((asset) => asset.mediaType !== 'video')
  const sponsors = archiveData?.sponsors.sponsors || []
  const standings = archiveData?.standings.standings || []
  const scoreCoverage = archiveData?.standings.scoreCoverage
  const finalGames = games.filter((game) => game.status === 'final' && game.homeScore !== null && game.awayScore !== null)
  const championRecords = archiveData?.champions.championRecords || []
  const primaryChampion = championRecords.find((record) => record.primary && record.status === 'completed') || championRecords.find((record) => record.status === 'completed') || championRecords[0]
  const isFinalArchive = tournament?.status === 'completed' || primaryChampion?.status === 'completed'
  const failed = archiveData?.failedSections

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
            {tournament?.hostClassLabel && <span>Host Class · {tournament.hostClassLabel}</span>}
            {tournament?.editionNumber != null && <span>Edition #{tournament.editionNumber}</span>}
            {tournament?.theme && <span>Theme · {tournament.theme}</span>}
          </div>
        </div>
        <img src="/brand/fd-crest.png" alt="" aria-hidden="true" />
      </section>

      {failed?.champions && (
        <Panel className="notice-panel">
          <span>Showing preserved offline champion records because the live champions API could not be reached.</span>{' '}
          <button type="button" className="btn secondary small" onClick={() => void reload()}>Retry</button>
        </Panel>
      )}

      {championRecords.length > 0 && <ChampionRecordsPanel records={championRecords} articles={articles} videos={videos} />}

      <div className="stats-grid four">
        <StatCard label="Games tracked" value={failed?.schedule ? '—' : games.length} tone="maroon" />
        <StatCard label="Final scores" value={failed?.schedule ? '—' : finalGames.length} detail={failed?.standings ? 'Unavailable' : scoreCoverage ? `${scoreCoverage.percent}% pool score coverage` : 'Coverage pending'} />
        <StatCard label="Articles" value={failed?.articles ? '—' : articles.length} tone="gold" />
        <StatCard label="Media" value={failed?.media ? '—' : mediaAssets.length} />
      </div>

      <section className="split-grid archive-split">
        <Panel>
          <div className="section-heading"><h2>Results and schedule</h2><span>{failed?.schedule ? 'Unavailable' : `${games.length} games`}</span></div>
          {failed?.schedule ? (
            <SectionUnavailable title="Schedule archive unavailable" description="Could not load archived games right now." onRetry={reload} />
          ) : !games.length ? (
            <EmptyState title="Schedule archive pending" description="Games for this tournament have not been loaded into the tournament archive yet." />
          ) : (
            <ArchiveGameList games={games} collapseUnscoredSlots={isFinalArchive} />
          )}
        </Panel>
        <Panel>
          <div className="section-heading"><h2>Standings snapshot</h2><span>{failed?.standings ? 'Unavailable' : visibleCountLabel(standings.length, Math.min(standings.length, 12), 'teams')}</span></div>
          {failed?.standings ? (
            <SectionUnavailable title="Standings archive unavailable" description="Could not load archived standings right now." onRetry={reload} />
          ) : !standings.length ? (
            <EmptyState title="Standings pending" description="Standings appear here when verified results are available for this tournament." />
          ) : (
            <ArchiveStandings standings={standings} />
          )}
        </Panel>
      </section>

      {videos.length > 0 && (
        <Panel>
          <div className="section-heading"><h2>Highlight Videos &amp; Broadcasts</h2><span>{videos.length}</span></div>
          <div className="media-gallery-grid">{videos.map((video) => <VideoEmbedCard key={video.id} asset={video} />)}</div>
        </Panel>
      )}
      <ArchiveArticles articles={articles} unavailable={Boolean(failed?.articles)} onRetry={reload} />
      <ArchiveMedia mediaAssets={photos} unavailable={Boolean(failed?.media)} onRetry={reload} />
      <ArchiveSponsors sponsors={sponsors} />
    </div>
  )
}

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

function ChampionRecordsPanel({ records, articles, videos }: { records: TournamentChampion[]; articles: Article[]; videos: MediaAsset[] }) {
  return (
    <Panel>
      <div className="section-heading"><h2>Champion record</h2><span>{records.length} {records.length === 1 ? 'edition' : 'editions'}</span></div>
      <div className="champion-record-grid">
        {records.map((record) => {
          const recap = articles.find((article) => article.id === record.recapArticleId)
          const highlight = videos.find((video) => video.id === record.highlightVideoId)
          return <article className="champion-record-card" key={record.id}>
            <div className="archive-chip-row"><span>{record.label}</span><DivisionPill division={record.bracket} /></div>
            {record.championKey && record.championLabel ? <Link to={`/classes/${classRouteKey(record.championKey)}`}><strong>{record.championLabel}</strong></Link> : <strong>{record.championLabel || 'Champion pending'}</strong>}
            <p>{record.runnerUpLabel ? `Runner-up: ${record.runnerUpLabel}` : record.notes || publicSourceLabel(record.source)}</p>
            <small>{record.score ? `${record.score} · ` : ''}{publicSourceLabel(record.source)}</small>
            <ArchiveChampionDetails
              record={{ ...record, sourceUrl: recap?.url || record.sourceUrl }}
              highlightHref={highlight ? `#archive-video-${highlight.id}` : undefined}
            />
          </article>
        })}
      </div>
    </Panel>
  )
}

function ArchiveGameList({ games, collapseUnscoredSlots = false }: { games: Game[]; collapseUnscoredSlots?: boolean }) {
  const scoredGames = games.filter((game) => game.homeScore !== null && game.awayScore !== null)
  const unscoredGames = games.filter((game) => game.homeScore === null || game.awayScore === null)
  const collapseUnscored = collapseUnscoredSlots && scoredGames.length > 0 && unscoredGames.length > 0
  const primaryGames = collapseUnscored ? scoredGames : games

  return (
    <div className="archive-game-list">
      <ArchiveGameGroups games={primaryGames} />
      {collapseUnscored && (
        <details className="archive-unscored-toggle">
          <summary>Show {unscoredGames.length} archived schedule {unscoredGames.length === 1 ? 'slot' : 'slots'} without recorded scores</summary>
          <ArchiveGameGroups games={unscoredGames} />
        </details>
      )}
    </div>
  )
}

function ArchiveGameGroups({ games }: { games: Game[] }) {
  const groups = new Map<string, Game[]>()
  games.forEach((game) => {
    const day = guamDayLabel(game.startTime)
    groups.set(day, [...(groups.get(day) || []), game])
  })

  return (
    <>
      {Array.from(groups.entries()).map(([day, dayGames]) => (
        <div key={day}>
          <h3>{day}</h3>
          {dayGames.map((game) => <ArchiveGameRow key={game.id} game={game} />)}
        </div>
      ))}
    </>
  )
}

function ArchiveGameRow({ game }: { game: Game }) {
  const result = gameResultLabel(game)
  const scoreReady = game.homeScore !== null && game.awayScore !== null
  const dateOnly = game.dateOnly
  const when = dateOnly ? formatGuamDate(game.startTime) : formatGuamDateTime(game.startTime)

  return (
    <article className="archive-game-row">
      <div>
        <strong><TeamNameLink team={game.awayTeam} fallback="Away team" /> at <TeamNameLink team={game.homeTeam} fallback="Home team" /></strong>
        <span>{when}{game.venue || !dateOnly ? ` · ${game.venue || DEFAULT_GAME_VENUE}` : ''}</span>
        {result && <small>{result}</small>}
        {game.statusNote && <small>{game.statusNote}</small>}
        {!!game.topPerformers?.length && (
          <ul className="archive-chip-row archive-performers" aria-label="Top performers">
            {game.topPerformers.map((performer) => <li className="archive-pill" key={performer}>{performer}</li>)}
          </ul>
        )}
      </div>
      <div className="archive-score">{scoreReady ? `${game.awayScore}–${game.homeScore}` : game.status === 'final' ? 'Score unrecorded' : 'Score pending'}</div>
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

function ArchiveArticles({ articles, unavailable, onRetry }: { articles: Article[]; unavailable: boolean; onRetry: () => void }) {
  return (
    <Panel>
      <div className="section-heading"><h2>Coverage from this tournament</h2><span>{unavailable ? 'Unavailable' : articles.length}</span></div>
      {unavailable ? (
        <SectionUnavailable title="Coverage archive unavailable" description="Could not load archived articles right now." onRetry={onRetry} />
      ) : !articles.length ? (
        <EmptyState title="Coverage pending" description="Articles and recaps will appear here as the archive is verified." />
      ) : (
        <div className="archive-card-grid">
          {articles.map((article) => {
            const href = safeHttpsHref(article.url)
            const content = (
              <>
                <span>{article.source}{article.publishedAt ? ` · ${formatGuamDate(article.publishedAt)}` : ''}</span>
                <strong>{article.title}</strong>
                <ArticleBadges article={article} />
                {article.excerpt && <p>{article.excerpt}</p>}
              </>
            )
            return href
              ? <a key={article.id} className="archive-link-card" href={href} target="_blank" rel="noreferrer">{content}<small>Read source <IconExternal /></small></a>
              : <article key={article.id} className="archive-link-card">{content}</article>
          })}
        </div>
      )}
    </Panel>
  )
}

function ArchiveMedia({ mediaAssets, unavailable, onRetry }: { mediaAssets: MediaAsset[]; unavailable: boolean; onRetry: () => void }) {
  const visibleMedia = mediaAssets.slice(0, 8)

  return (
    <Panel>
      <div className="section-heading"><h2>Photos and media</h2><span>{unavailable ? 'Unavailable' : visibleCountLabel(mediaAssets.length, visibleMedia.length)}</span></div>
      {unavailable ? (
        <SectionUnavailable title="Media archive unavailable" description="Could not load archived photos right now." onRetry={onRetry} />
      ) : !mediaAssets.length ? (
        <EmptyState title="Media pending" description="Photos will appear here when this tournament's media archive is available." />
      ) : (
        <div className="archive-media-strip">
          {visibleMedia.map((asset) => <article key={asset.id}>{asset.imageUrl && <img src={asset.imageUrl} alt={asset.caption || asset.title} loading="lazy" />}<div><strong>{asset.title}</strong><span>{asset.source}</span></div></article>)}
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
