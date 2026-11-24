import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDate } from '../../lib/datetime'
import { gameOptionLabel } from '../../lib/games'
import type { Article } from '../../lib/types'
import { EmptyState, LoadingState, PageHeader, SectionUnavailable } from '../../components/ui'
import { ArticleBadges } from '../../components/ArchiveBadges'
import { IconExternal } from '../../components/Icons'

function articleYear(article: Article): number | null {
  if (article.tournamentYear) return article.tournamentYear
  if (!article.publishedAt) return null
  const year = new Date(article.publishedAt).getFullYear()
  return Number.isFinite(year) ? year : null
}

export function NewsPage() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const { data, loading, error, reload } = useAsync(() => api.publicArticles({ archive: true, limit: 200 }), [])
  const allArticles = data?.articles ?? []

  const years = useMemo(() => {
    const unique = new Set<number>()
    allArticles.forEach((article) => {
      const year = articleYear(article)
      if (year) unique.add(year)
    })
    return Array.from(unique).sort((a, b) => b - a)
  }, [allArticles])

  const articles = useMemo(
    () => (selectedYear ? allArticles.filter((article) => articleYear(article) === selectedYear) : allArticles),
    [allArticles, selectedYear],
  )

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Coverage archive"
        title="News and tournament coverage"
        description="Linked coverage from GSPN, PostGuam, GuamPDN, and other sources. This hub preserves context and sends readers to the original publisher."
      />

      {years.length > 1 && (
        <div className="gallery-filters" role="group" aria-label="Filter coverage by year">
          <button
            type="button"
            className={`btn small ${selectedYear === null ? 'primary' : 'secondary'}`}
            aria-pressed={selectedYear === null}
            onClick={() => setSelectedYear(null)}
          >
            All years ({allArticles.length})
          </button>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className={`btn small ${selectedYear === year ? 'primary' : 'secondary'}`}
              aria-pressed={selectedYear === year}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {loading && !data ? (
        <LoadingState label="Loading news archive" />
      ) : error && !data ? (
        <SectionUnavailable
          title="Coverage links are temporarily unavailable"
          description="Could not reach the coverage archive API right now."
          onRetry={reload}
        />
      ) : !articles.length ? (
        <EmptyState title="No coverage links posted yet" description="Tournament stories, recaps, and partner coverage will appear here as they are published." />
      ) : (
        <div className="article-grid">
          {articles.map((article) => (
            <a key={article.id} className="article-card" href={article.url} target="_blank" rel="noreferrer">
              <ArticleImage src={article.imageUrl} />
              <div>
                <span>
                  {article.source}
                  {article.publishedAt ? ` · ${formatGuamDate(article.publishedAt)}` : article.tournamentYear ? ` · ${article.tournamentYear}` : ''}
                </span>
                <h2>{article.title}</h2>
                <ArticleBadges article={article} />
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

function ArticleImage({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) return <div className="image-placeholder">FD</div>

  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
}
