import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatGuamDateTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, gameResultLabel } from '../../lib/games'
import { classDisplayLabel, classKeyFromRoute, classRouteKey } from '../../lib/history'
import { useAsync } from '../../lib/hooks'
import type { Article, Game, Team, TournamentChampion } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui'
import { IconArrowRight, IconExternal } from '../../components/Icons'

export function ClassProfilePage() {
  const { classKey = '' } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    if (!classKey) throw new Error('Class archive not found')
    return api.publicClass(classKey)
  }, [classKey])

  if (loading && !data) return <LoadingState label="Loading class archive" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <EmptyState title="Class archive unavailable" />

  const profile = data.classProfile
  const canonicalKey = classKeyFromRoute(profile.classKey)
  const components = canonicalKey.split('/').filter(Boolean)
  const latestTeam = data.teams[0]
  const finalGames = data.games.filter((game) => game.status === 'final')
  const titleDetail = profile.titleYears.length ? `Latest ${profile.titleYears[0]}` : 'No titles verified yet'

  return (
    <div className="page-stack class-profile-page">
      <PageHeader
        eyebrow="Class archive"
        title={profile.displayName || classDisplayLabel(profile.classKey)}
        description={classArchiveDescription(canonicalKey, profile.titleCount)}
        actions={
          <>
            <Link className="btn secondary" to="/history">Back to history <IconArrowRight /></Link>
            {latestTeam && <Link className="btn primary" to={`/teams/${latestTeam.id}`}>Latest team page</Link>}
          </>
        }
      />

      <div className="stats-grid four class-compact-stats">
        <StatCard label="Titles" value={profile.titleCount} detail={titleDetail} tone="maroon" />
        <StatCard label="Team entries" value={profile.teamCount} detail={profile.latestTournamentYear ? `Latest ${profile.latestTournamentYear}` : 'No team rows yet'} />
        <StatCard label="Games tracked" value={data.games.length} detail={`${finalGames.length} final`} tone="gold" />
        <StatCard label="Coverage" value={data.articles.length} detail="linked articles" />
      </div>

      <Panel className="class-profile-note">
        <strong>{components.length > 1 ? 'Combined class record' : 'Individual class record'}</strong>
        <p>
          {components.length > 1
            ? `${profile.displayName} is tracked separately from ${components.map(classDisplayLabel).join(' and ')}. Combined titles do not inflate the individual class totals.`
            : 'Individual class titles are counted separately from any later combined-class teams that include this class.'}
        </p>
        {components.length > 1 && (
          <div className="class-chip-row">
            {components.map((component) => <Link key={component} to={`/classes/${classRouteKey(component)}`}>{classDisplayLabel(component)}</Link>)}
          </div>
        )}
      </Panel>

      <div className="split-grid class-profile-split">
        <Panel>
          <div className="section-heading"><h2>Title history</h2><span>{data.titleRecords.length}</span></div>
          {!data.titleRecords.length ? <EmptyState title="No verified titles" description="Champion records are still being verified for this class archive." /> : <TitleRecordList records={data.titleRecords} />}
        </Panel>
        <Panel>
          <div className="section-heading"><h2>{components.length > 1 ? 'Individual class links' : 'Combined class context'}</h2><span>{data.relatedTitleRecords.length || components.length}</span></div>
          {components.length > 1 ? (
            <div className="class-link-list">
              {components.map((component) => <Link key={component} to={`/classes/${classRouteKey(component)}`}>{classDisplayLabel(component)}<IconArrowRight /></Link>)}
            </div>
          ) : data.relatedTitleRecords.length ? <TitleRecordList records={data.relatedTitleRecords} compact /> : <EmptyState title="No combined records found" description="If this class later merged with another class, those confirmed records will appear here." />}
        </Panel>
      </div>

      <div className="split-grid class-profile-split">
        <Panel>
          <div className="section-heading"><h2>Tournament teams</h2><span>{data.teams.length}</span></div>
          {!data.teams.length ? <EmptyState title="Team rows pending" description="This class does not have tournament team data loaded yet." /> : <TeamArchiveList teams={data.teams} />}
        </Panel>
        <Panel>
          <div className="section-heading"><h2>Recent games</h2><span>{data.games.length}</span></div>
          {!data.games.length ? <EmptyState title="Schedule archive pending" description="Games for this class will appear when historical schedules are loaded." /> : <ClassGameList games={data.games.slice(0, 8)} classKey={canonicalKey} />}
        </Panel>
      </div>

      <Panel>
        <div className="section-heading"><h2>Coverage involving this class</h2><span>{data.articles.length}</span></div>
        {!data.articles.length ? <EmptyState title="Coverage pending" description="Class-specific and title-year coverage will appear here as sources are linked." /> : <CoverageList articles={data.articles} />}
      </Panel>
    </div>
  )
}

function TitleRecordList({ records, compact = false }: { records: TournamentChampion[]; compact?: boolean }) {
  return (
    <div className={compact ? 'title-history-list compact-title-history-list' : 'title-history-list'}>
      {records.map((record) => (
        <Link key={record.id} to={`/history/${record.year}`} className="title-history-row">
          <strong>{record.label}</strong>
          <span>{titleRecordSubhead(record)}</span>
          <small>{record.score ? `${record.score} · ` : ''}{record.source}</small>
        </Link>
      ))}
    </div>
  )
}

function TeamArchiveList({ teams }: { teams: Team[] }) {
  return (
    <div className="class-team-list">
      {teams.map((team) => (
        <Link key={team.id} to={`/teams/${team.id}`}>
          <span>{team.tournamentYear ? `${team.tournamentYear} entry` : team.classYearLabel}</span>
          <strong>{team.displayName}</strong>
          <small>{team.division || 'Division pending'}<IconArrowRight /></small>
        </Link>
      ))}
    </div>
  )
}

function ClassGameList({ games, classKey }: { games: Game[]; classKey: string }) {
  return (
    <div className="team-game-list">
      {games.map((game) => {
        const homeMatches = classKeyFromRoute(game.homeTeam?.displayName || game.homeTeam?.classYearLabel) === classKey
        const opponent = homeMatches ? game.awayTeam : game.homeTeam
        const result = gameResultLabel(game)
        return (
          <article key={game.id} className="team-game-row">
            <div>
              <span>{formatGuamDateTime(game.startTime)}</span>
              <strong>{homeMatches ? 'vs' : 'at'} {opponent?.displayName || 'Opponent TBD'}</strong>
              <small>{game.venue || DEFAULT_GAME_VENUE}{game.division ? ` · ${game.division}` : ''}</small>
              {result && <small>{result}</small>}
            </div>
            <div className="team-game-score"><StatusBadge status={game.status} /></div>
          </article>
        )
      })}
    </div>
  )
}

function CoverageList({ articles }: { articles: Article[] }) {
  return (
    <div className="article-grid class-coverage-grid">
      {articles.slice(0, 6).map((article) => (
        <a key={article.id} className="article-card" href={article.url} target="_blank" rel="noreferrer">
          {article.imageUrl ? <img src={article.imageUrl} alt="" loading="lazy" /> : <div className="image-placeholder">FD</div>}
          <div>
            <span>{article.source}</span>
            <h2>{article.title}</h2>
            {article.excerpt && <p>{article.excerpt}</p>}
            <small>Open source <IconExternal /></small>
          </div>
        </a>
      ))}
    </div>
  )
}

function classArchiveDescription(classKey: string, titles: number) {
  const isCombined = classKey.includes('/')
  const titleCopy = titles === 1 ? '1 verified title' : `${titles} verified titles`
  return `${titleCopy}. ${isCombined ? 'This combined class archive is kept separate from the individual class pages.' : 'This individual class archive stays separate from combined-class records.'}`
}

function titleRecordSubhead(record: TournamentChampion) {
  const bracket = championBracketLabel(record)
  return record.runnerUpLabel ? `${bracket} · Runner-up: ${record.runnerUpLabel}` : bracket
}

function championBracketLabel(record: TournamentChampion) {
  if (record.bracket === 'maroon') return 'Maroon champion'
  if (record.bracket === 'gold') return 'Gold champion'
  return record.primary ? 'Primary champion' : 'Champion record'
}
