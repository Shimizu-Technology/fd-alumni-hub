import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { CHAMPIONS, type ChampionRecord } from '../../lib/history'
import { useAsync } from '../../lib/hooks'
import type { Tournament } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui'
import { IconArrowRight } from '../../components/Icons'

export function HistoryPage() {
  const { data, loading, error, reload } = useAsync(() => api.publicTournaments(), [])
  const records = mergeHistoryRecords(CHAMPIONS, data?.tournaments || [])
  const completed = records.filter((record) => record.status === 'completed')
  const titleCount = completed.reduce<Record<string, number>>((acc, record) => {
    if (record.champion) acc[record.champion] = (acc[record.champion] || 0) + 1
    return acc
  }, {})
  const dynasty = Object.entries(titleCount).sort((a, b) => b[1] - a[1])[0]

  if (loading && !data) return <LoadingState label="Loading history" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack history-page">
      <PageHeader
        eyebrow="Historical archive"
        title="Brotherhood tournament history"
        description="Champion records, game results, photos, and source coverage are collected by tournament year. Some older years are still marked with research gaps while the archive is verified."
      />

      <div className="stats-grid three">
        <StatCard label="Tracked years" value={records.length} tone="maroon" />
        <StatCard label="Completed records" value={completed.length} />
        <StatCard label="Most titles in archive" value={dynasty ? dynasty[1] : 0} detail={dynasty?.[0]} tone="gold" />
      </div>

      <Panel>
        <div className="section-heading">
          <h2>Tournament years</h2>
          <Link to="/news">Coverage archive <IconArrowRight /></Link>
        </div>
        {!records.length ? <EmptyState title="History archive pending" /> : (
          <div className="timeline-list">
            {records.map((record) => (
              <Link key={record.year} to={`/history/${record.year}`} className="timeline-row timeline-link-row">
                <div className="timeline-year">{record.year}</div>
                <div>
                  <div className="timeline-title">
                    <strong>{record.champion || 'Champion research pending'}</strong>
                    <StatusBadge status={record.status} />
                  </div>
                  <p>{record.runnerUp ? `Runner-up: ${record.runnerUp}` : record.note || 'Open tournament archive'}</p>
                  <small>{record.score ? `${record.score} · ` : ''}{record.source}</small>
                </div>
                <IconArrowRight />
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

type HistoryRecord = ChampionRecord & { tournamentId?: string }

function mergeHistoryRecords(records: ChampionRecord[], tournaments: Tournament[]): HistoryRecord[] {
  const byYear = new Map(records.map((record) => [record.year, { ...record } as HistoryRecord]))

  tournaments.forEach((tournament) => {
    const existing = byYear.get(tournament.year)
    const databaseRecord: HistoryRecord = {
      year: tournament.year,
      source: 'Tournament database',
      status: historyStatusForTournament(tournament),
      note: tournament.status === 'completed' ? undefined : `${tournament.status} tournament`,
    }

    byYear.set(tournament.year, existing ? { ...existing, tournamentId: tournament.id } : { ...databaseRecord, tournamentId: tournament.id })
  })

  return Array.from(byYear.values()).sort((a, b) => b.year - a.year)
}

function historyStatusForTournament(tournament: Tournament): ChampionRecord['status'] {
  if (tournament.status === 'completed') return 'completed'
  if (tournament.status === 'cancelled') return 'cancelled'
  return 'unknown'
}
