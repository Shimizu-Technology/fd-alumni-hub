import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard } from '../../components/ui'

export function AdminOverviewPage() {
  const { data, loading, error, reload } = useAsync(() => api.adminDashboard(), [])

  if (loading) return <LoadingState label="Loading admin dashboard" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <EmptyState title="Dashboard unavailable" />

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin console"
        title="Tournament operations"
        description="Manage games, links, coverage, sponsors, and data health for the Rails-backed hub."
      />

      <div className="stats-grid four">
        <StatCard label="Teams" value={data.counts.teams || 0} tone="maroon" />
        <StatCard label="Games" value={data.counts.games || 0} />
        <StatCard label="Final games" value={data.counts.finalGames || 0} tone="gold" />
        <StatCard label="Coverage links" value={data.counts.articles || 0} />
      </div>

      <div className="split-grid">
        <Panel>
          <div className="section-heading"><h2>Data health</h2><Link to="/admin/missing-links">Review</Link></div>
          <div className="health-grid">
            <div><strong>{data.missing.scores}</strong><span>Final games missing scores</span></div>
            <div><strong>{data.missing.streams}</strong><span>Games missing streams</span></div>
            <div><strong>{data.missing.tickets}</strong><span>Games missing tickets</span></div>
          </div>
        </Panel>
        <Panel>
          <div className="section-heading"><h2>Latest coverage</h2><Link to="/admin/news">Manage</Link></div>
          {data.recentArticles.length === 0 ? <EmptyState title="No articles" /> : (
            <div className="compact-list">
              {data.recentArticles.map((article) => <a key={article.id} className="compact-row" href={article.url} target="_blank" rel="noreferrer"><span>{article.source}</span><strong>{article.title}</strong></a>)}
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <div className="admin-shortcuts">
          <Link to="/admin/games">Edit games</Link>
          <Link to="/admin/standings">Recompute standings</Link>
          <Link to="/admin/links">Bulk update links</Link>
          <Link to="/admin/ingest">Review ingest queue</Link>
        </div>
      </Panel>
    </div>
  )
}
