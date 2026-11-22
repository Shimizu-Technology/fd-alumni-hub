import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { classRouteKey } from '../../lib/history'
import { useAsync } from '../../lib/hooks'
import { staticChampionRecords, staticTitleCounts } from '../../lib/staticChampions'
import type { Tournament, TournamentChampion } from '../../lib/types'
import { EmptyState, LoadingState, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui'
import { IconArrowRight } from '../../components/Icons'

export function HistoryPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, champions] = await Promise.all([api.publicTournaments(), api.publicChampions()])
    return { tournaments: tournaments.tournaments, championRecords: champions.championRecords, titleCounts: champions.titleCounts }
  }, [])

  const usingOfflineArchive = Boolean(error && !data)
  const fallbackChampions = useMemo(() => staticChampionRecords(), [])
  const fallbackTitleCounts = useMemo(() => staticTitleCounts(), [])

  const records = usingOfflineArchive
    ? mergeHistoryRecords(fallbackChampions, [])
    : mergeHistoryRecords(data?.championRecords || [], data?.tournaments || [])
  const titleCounts = usingOfflineArchive ? fallbackTitleCounts : (data?.titleCounts || [])
  const completed = records.filter((record) => record.status === 'completed')
  const dynasty = titleCounts[0]

  return (
    <div className="page-stack history-page">
      <PageHeader
        eyebrow="Historical archive"
        title="Brotherhood tournament history"
        description="Champion records, class title credits, game results, photos, and source coverage are collected by tournament edition. Shared-team wins credit every represented class while preserving the original team entry."
      />

      {loading && !data ? (
        <LoadingState label="Loading history" />
      ) : (
        <>
          {usingOfflineArchive && (
            <Panel className="notice-panel offline-section-notice">
              <span>Showing the preserved offline champion archive while live tournament history services are unavailable.</span>
              <button type="button" className="btn secondary small" onClick={() => void reload()}>Retry</button>
            </Panel>
          )}

          <div className="stats-grid three">
            <StatCard label="Tracked editions" value={records.length} tone="maroon" />
            <StatCard label="Completed records" value={completed.length} />
            <StatCard label="Most titles in archive" value={dynasty?.titles || 0} detail={dynasty?.championLabel} tone="gold" />
          </div>

          <Panel className="title-leaderboard-panel">
            <div className="section-heading">
              <h2>Class title credits</h2>
              <span>Shared wins count for each represented class</span>
            </div>
            {!titleCounts.length ? <EmptyState title="Title history pending" /> : (
              <div className="title-leaderboard-grid">
                {titleCounts.slice(0, 8).map((entry) => (
                  <Link key={entry.championKey} to={`/classes/${classRouteKey(entry.championKey)}`} className="title-leaderboard-card">
                    <span>{entry.championLabel}</span>
                    <strong>{entry.titles}</strong>
                    <small>{entry.years.join(', ')}</small>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <div className="section-heading">
              <h2>Tournament champions</h2>
              <Link to="/news">Coverage archive <IconArrowRight /></Link>
            </div>
            {!records.length ? <EmptyState title="History archive pending" /> : (
              <div className="timeline-list">
                {records.map((record) => (
                  <Link key={record.id} to={`/history/${record.year}`} className="timeline-row timeline-link-row">
                    <div className="timeline-year">{record.label}</div>
                    <div>
                      <div className="timeline-title">
                        <strong>{record.championLabel || 'Champion research pending'}</strong>
                        <StatusBadge status={record.status} />
                      </div>
                      <p>{record.runnerUpLabel ? `Runner-up: ${record.runnerUpLabel}` : record.notes || 'Open tournament archive'}</p>
                      <small>{record.score ? `${record.score} · ` : ''}{record.source}</small>
                    </div>
                    <IconArrowRight />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}

type HistoryRecord = Pick<TournamentChampion, 'id' | 'tournamentId' | 'year' | 'editionLabel' | 'label' | 'championLabel' | 'runnerUpLabel' | 'score' | 'status' | 'source' | 'notes'>

function mergeHistoryRecords(records: TournamentChampion[], tournaments: Tournament[]): HistoryRecord[] {
  const historyRecords: HistoryRecord[] = records.map((record) => ({ ...record }))
  const existingYears = new Set(records.map((record) => record.year))

  tournaments.forEach((tournament) => {
    if (existingYears.has(tournament.year)) return

    historyRecords.push({
      id: `tournament-${tournament.id}`,
      tournamentId: tournament.id,
      year: tournament.year,
      editionLabel: null,
      label: String(tournament.year),
      championLabel: null,
      runnerUpLabel: null,
      score: null,
      source: 'Tournament database',
      status: tournament.status === 'completed' || tournament.status === 'cancelled' || tournament.status === 'upcoming' || tournament.status === 'live' ? tournament.status === 'live' ? 'upcoming' : tournament.status : 'unknown',
      notes: tournament.status === 'completed' ? null : `${tournament.status} tournament`,
    })
  })

  return historyRecords.sort((a, b) => b.year - a.year || a.label.localeCompare(b.label))
}
