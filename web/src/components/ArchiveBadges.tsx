import type { Article } from '../lib/types'

const divisionLabels: Record<string, string> = {
  maroon: 'Maroon',
  gold: 'Gold',
  platinum: 'Platinum',
  fatherson: 'Father/Son',
}

const kindLabels = {
  preview: 'Preview',
  recap: 'Recap',
  playoffs: 'Playoffs',
  championship: 'Championship',
  history: 'History',
  event_page: 'Event page',
}

export function DivisionPill({ division }: { division?: string | null }) {
  const label = division ? divisionLabels[division] : undefined
  return typeof label === 'string' ? <span className={`archive-pill archive-pill--${division}`}>{label}</span> : null
}

export function ArticleBadges({ article }: { article: Article }) {
  return (
    <div className="archive-chip-row">
      <span className="archive-pill">{kindLabels[article.kind || 'recap']}</span>
      <DivisionPill division={article.divisionSlug} />
      {article.photoCount != null && <span className="archive-pill">{article.photoCount} {article.photoCount === 1 ? 'photo' : 'photos'}</span>}
    </div>
  )
}
