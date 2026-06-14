import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDate } from '../../lib/datetime'
import { gameOptionLabel } from '../../lib/games'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { IconExternal } from '../../components/Icons'

export function NewsPage() {
  const { data, loading, error, reload } = useAsync(() => api.publicArticles({ limit: 200 }), [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Coverage archive"
        title="News and tournament coverage"
        description="Linked coverage from GSPN, PostGuam, GuamPDN, and other sources. This hub preserves context and sends readers to the original publisher."
      />

      {!data?.articles.length ? (
        <EmptyState title="No coverage links posted yet" description="Tournament stories, recaps, and partner coverage will appear here as they are published." />
      ) : (
        <div className="article-grid">
          {data.articles.map((article) => (
            <a key={article.id} className="article-card" href={article.url} target="_blank" rel="noreferrer">
              {article.imageUrl ? <img src={article.imageUrl} alt="" loading="lazy" /> : <div className="image-placeholder">FD</div>}
              <div>
                <span>{article.source} · {article.publishedAt ? formatGuamDate(article.publishedAt) : 'Date pending'}</span>
                <h2>{article.title}</h2>
                {article.game && <small>{gameOptionLabel(article.game)}</small>}
                {article.excerpt && <p>{article.excerpt}</p>}
                <small>Read source <IconExternal /></small>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
