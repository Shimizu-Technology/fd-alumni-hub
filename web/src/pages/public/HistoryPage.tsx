import { Link } from 'react-router-dom'
import { CHAMPIONS } from '../../lib/history'
import { PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui'
import { IconArrowRight } from '../../components/Icons'

export function HistoryPage() {
  const completed = CHAMPIONS.filter((record) => record.status === 'completed')
  const titleCount = completed.reduce<Record<string, number>>((acc, record) => {
    if (record.champion) acc[record.champion] = (acc[record.champion] || 0) + 1
    return acc
  }, {})
  const dynasty = Object.entries(titleCount).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Historical archive"
        title="Brotherhood tournament history"
        description="Verified champion records, cancelled years, and research gaps are preserved here while original articles remain linked in the news archive."
      />

      <div className="stats-grid three">
        <StatCard label="Tracked years" value={CHAMPIONS.length} tone="maroon" />
        <StatCard label="Completed records" value={completed.length} />
        <StatCard label="Most titles in archive" value={dynasty ? dynasty[1] : 0} detail={dynasty?.[0]} tone="gold" />
      </div>

      <Panel>
        <div className="section-heading">
          <h2>Champion ledger</h2>
          <Link to="/news">Coverage archive <IconArrowRight /></Link>
        </div>
        <div className="timeline-list">
          {CHAMPIONS.map((record) => (
            <article key={record.year} className="timeline-row">
              <div className="timeline-year">{record.year}</div>
              <div>
                <div className="timeline-title">
                  <strong>{record.champion || 'Champion unverified'}</strong>
                  <StatusBadge status={record.status} />
                </div>
                <p>{record.runnerUp ? `Runner-up: ${record.runnerUp}` : record.note || 'Research pending'}</p>
                <small>{record.score ? `${record.score} · ` : ''}{record.source}</small>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  )
}
