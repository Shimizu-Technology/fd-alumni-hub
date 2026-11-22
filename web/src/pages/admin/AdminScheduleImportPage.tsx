import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthContext } from '../../contexts/AuthContext'
import { selectedTournament, tournamentScopedPath, useTournamentSelection } from '../../lib/admin'
import { formatGuamDateTime } from '../../lib/datetime'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type {
  Division,
  GamePhase,
  RosterImportCommitResult,
  RosterImportPreview,
  RosterImportRow,
  ScheduleImportCommitResult,
  ScheduleImportPreview,
  ScheduleImportRow,
  Tournament,
} from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatCard, StatusBadge } from '../../components/ui'

type ImportTab = 'schedule' | 'roster'

const SAMPLE_SCHEDULE_CSV = `game_number,date,time,away_team,home_team,division,phase,venue
G1,2027-07-02,18:00,Class of 2016,Class of 2017,Maroon,pool,The Jungle
G2,2027-07-02,19:15,Class of 2018,Class of 2019,Maroon,pool,The Jungle`

const SAMPLE_ROSTER_CSV = `team,name,jersey_number,position,nickname
Class of 2017,John Cruz,23,G,JC
Class of 2017,Mike Santos,12,F,`

const PHASE_OPTIONS: GamePhase[] = ['pool', 'playoff', 'fatherson', 'exhibition']

export function AdminScheduleImportPage() {
  const auth = useAuthContext()
  const isAdmin = Boolean(auth.user?.isAdmin)
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [tab, setTab] = useState<ImportTab>('schedule')

  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, divisions] = await Promise.all([
      api.adminTournaments("schedule_and_teams"),
      api.adminDivisions(tournamentId || null),
    ])
    return { tournaments: tournaments.tournaments, divisions: divisions.divisions }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  if (loading && !data) return <LoadingState label="Loading importer" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournaments = data?.tournaments || []
  const tournament = selectedTournament(tournaments, tournamentId)
  const divisions = (data?.divisions || []).filter((d) => !tournament || !d.tournamentId || d.tournamentId === tournament.id)

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Schedule & roster importer"
        description="Upload a CSV or paste FDMSAA schedule text to preview every create, update, new team, and unmatched existing game before writing to the database."
        actions={
          tournament && (
            <div className="row-actions">
              <Link className="btn secondary" to={tournamentScopedPath('/admin/divisions', tournament.id)}>Teams &amp; divisions</Link>
              <Link className="btn secondary" to={tournamentScopedPath('/admin/games', tournament.id)}>Games</Link>
            </div>
          )
        }
      />

      <Panel className="toolbar-panel">
        <label>
          <span>Tournament</span>
          <select value={tournament?.id || ''} onChange={(event) => setTournamentId(event.target.value)}>
            {tournaments.map((item) => (
              <option key={item.id} value={item.id}>{item.year} · {item.name}</option>
            ))}
          </select>
        </label>
        <div className="row-actions" role="tablist" aria-label="Import mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'schedule'}
            className={tab === 'schedule' ? 'btn primary small' : 'btn secondary small'}
            onClick={() => setTab('schedule')}
          >
            Schedule import
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'roster'}
            className={tab === 'roster' ? 'btn primary small' : 'btn secondary small'}
            onClick={() => setTab('roster')}
          >
            Roster import
          </button>
        </div>
      </Panel>

      {!tournament ? (
        <EmptyState title="Select a tournament first" description="Create or choose a tournament before importing schedules or rosters." />
      ) : tab === 'schedule' ? (
        <ScheduleImporterPanel key={`schedule-${tournament.id}`} tournament={tournament} divisions={divisions} isAdmin={isAdmin} />
      ) : (
        <RosterImporterPanel key={`roster-${tournament.id}`} tournament={tournament} />
      )}
    </div>
  )
}

function ScheduleImporterPanel({ tournament, divisions, isAdmin }: { tournament: Tournament; divisions: Division[]; isAdmin: boolean }) {
  const [format, setFormat] = useState<'auto' | 'csv' | 'fdmsaa_text'>('auto')
  const [defaultVenue, setDefaultVenue] = useState('The Jungle')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState<ScheduleImportPreview | null>(null)
  const [draftRows, setDraftRows] = useState<ScheduleImportRow[]>([])
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(new Set())
  const [overwriteScores, setOverwriteScores] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [commitResult, setCommitResult] = useState<ScheduleImportCommitResult | null>(null)

  const includedRows = useMemo(
    () => draftRows.filter((row) => !excludedIndexes.has(row.rowIndex)),
    [draftRows, excludedIndexes],
  )
  const includedErrorCount = useMemo(
    () => includedRows.filter((row) => row.action === 'error' || row.errors.length > 0).length,
    [includedRows],
  )

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 512_000) {
      setError('Schedule file exceeds the 500 KB limit.')
      return
    }
    try {
      const text = await file.text()
      setContent(text)
      setPreview(null)
      setCommitResult(null)
      setOverwriteScores(false)
      setError('')
    } catch {
      setError('Unable to read the selected file.')
    }
  }

  const runPreview = async (structuredRows?: ScheduleImportRow[]) => {
    setBusy(true)
    setError('')
    setCommitResult(null)
    if (!structuredRows) setOverwriteScores(false)
    try {
      const response = await api.adminPreviewScheduleImport(
        tournament.id,
        structuredRows
          ? { rows: structuredRows, defaultVenue }
          : { format, content, defaultVenue },
      )
      setPreview(response)
      if (structuredRows) {
        // Merge re-validated rows back into draftRows so excluded rows remain visible and toggleable
        const updatedByIndex = new Map(response.rows.map((row) => [row.rowIndex, row]))
        setDraftRows((current) => current.map((row) => updatedByIndex.get(row.rowIndex) || row))
      } else {
        setDraftRows(response.rows)
        setExcludedIndexes(new Set())
      }
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to preview schedule import'))
    } finally {
      setBusy(false)
    }
  }

  const updateRowField = (rowIndex: number, patch: Partial<ScheduleImportRow>) => {
    setDraftRows((current) =>
      current.map((row) => (row.rowIndex === rowIndex ? { ...row, ...patch } : row)),
    )
  }

  const toggleExclude = (rowIndex: number) => {
    setExcludedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) next.delete(rowIndex)
      else next.add(rowIndex)
      return next
    })
  }

  const commit = async () => {
    if (!includedRows.length) {
      setError('Include at least one row to commit.')
      return
    }
    if (isAdmin && overwriteScores && !window.confirm('Overwrite existing scores and statuses for matched games in this import?')) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await api.adminCommitScheduleImport(tournament.id, {
        rows: includedRows,
        overwriteScores: isAdmin ? overwriteScores : false,
        defaultVenue,
      })
      setCommitResult(result)
      setOverwriteScores(false)
      setPreview(null)
      setDraftRows([])
      setExcludedIndexes(new Set())
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to commit schedule import'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <Panel>
        <div className="section-heading">
          <div>
            <h2>1. Paste or upload schedule ({tournament.year})</h2>
            <p className="muted">Preview is strictly read-only — zero database writes occur until you click Commit.</p>
          </div>
          <button type="button" className="btn secondary small" onClick={() => setContent(SAMPLE_SCHEDULE_CSV)}>
            Load sample CSV
          </button>
        </div>
        <FormGrid>
          <Field label="Input format">
            <select value={format} onChange={(event) => setFormat(event.target.value as 'auto' | 'csv' | 'fdmsaa_text')}>
              <option value="auto">Auto-detect (CSV or FDMSAA text)</option>
              <option value="csv">CSV</option>
              <option value="fdmsaa_text">FDMSAA PDF text</option>
            </select>
          </Field>
          <Field label="Default venue">
            <input value={defaultVenue} onChange={(event) => setDefaultVenue(event.target.value)} placeholder="The Jungle" />
          </Field>
          <Field label="Upload CSV / TXT file">
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => void handleFile(event)} />
          </Field>
        </FormGrid>
        <Field label="Schedule CSV or pasted FDMSAA PDF text">
          <textarea
            rows={8}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={'game_number,date,time,away_team,home_team,division,phase\nG1,2027-07-02,18:00,Class of 2016,Class of 2017,Maroon,pool'}
          />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row-actions">
          <button type="button" className="btn primary" disabled={busy || !content.trim()} onClick={() => void runPreview()}>
            {busy ? 'Analyzing…' : 'Preview schedule import'}
          </button>
        </div>
      </Panel>

      {commitResult && (
        <Panel className="notice-panel">
          <div role="status">
            <strong>Schedule import committed.</strong>{' '}
            Created {commitResult.createdTeams} teams, {commitResult.createdGames} games; updated {commitResult.updatedGames}; unchanged {commitResult.unchangedGames}.{' '}
            {commitResult.standingsStatus === 'failed'
              ? 'Standings refresh failed — please recompute standings from Standings.'
              : commitResult.recompute
                ? `Standings recomputed for ${commitResult.recompute.teams} teams.`
                : null}{' '}
            <Link to={tournamentScopedPath('/admin/games', tournament.id)}>View schedule</Link>
          </div>
        </Panel>
      )}

      {preview && (
        <>
          <div className="stats-grid four">
            <StatCard label="Creates" value={preview.summary.createCount} tone="maroon" />
            <StatCard label="Updates" value={preview.summary.updateCount} tone="gold" />
            <StatCard label="New teams" value={preview.summary.newTeamsCount} />
            <StatCard label="Errors" value={includedErrorCount} />
          </div>

          {preview.skippedLines && preview.skippedLines.length > 0 && (
            <Panel className="notice-panel">
              <h3>Skipped unparsed lines ({preview.skippedLines.length})</h3>
              <p className="muted">These non-empty lines were not recognized as dates or game rows. Check whether any game was missed before committing.</p>
              <ul className="compact-list">
                {preview.skippedLines.slice(0, 20).map((item) => (
                  <li key={`${item.lineNumber}-${item.text}`}><strong>Line {item.lineNumber}:</strong> {item.text}</li>
                ))}
              </ul>
              {preview.skippedLines.length > 20 && <p className="muted">+{preview.skippedLines.length - 20} more skipped lines.</p>}
            </Panel>
          )}

          {preview.unmatchedExistingGames.length > 0 && (
            <Panel className="notice-panel">
              <h3>Unmatched existing games ({preview.unmatchedExistingGames.length})</h3>
              <p className="muted">
                These existing games in {tournament.year} were not matched by any row in this import (e.g., typhoon reschedule or renumbering). They will NOT be deleted automatically — review before committing to avoid duplicates.
              </p>
              <ul className="compact-list">
                {preview.unmatchedExistingGames.slice(0, 12).map((game) => (
                  <li key={game.id}>
                    <strong>{game.gameNumber || `Game #${game.id}`}</strong> · {game.awayTeam} at {game.homeTeam}{' '}
                    ({game.startTime ? formatGuamDateTime(game.startTime) : 'TBD'}) · {game.status}
                    {game.hasScores ? ' · has scores' : ''}
                  </li>
                ))}
              </ul>
              {preview.unmatchedExistingGames.length > 12 && (
                <p className="muted">+{preview.unmatchedExistingGames.length - 12} more unmatched existing games.</p>
              )}
            </Panel>
          )}

          <Panel>
            <div className="section-heading">
              <div>
                <h2>2. Review rows ({includedRows.length} included of {draftRows.length})</h2>
                <p className="muted">Fix divisions/phases inline or exclude bad rows, then click Re-validate before committing.</p>
              </div>
              <div className="row-actions">
                <button type="button" className="btn secondary small" disabled={busy} onClick={() => void runPreview(includedRows)}>
                  Re-validate rows
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || includedRows.length === 0 || includedErrorCount > 0}
                  onClick={() => void commit()}
                >
                  {busy ? 'Committing…' : `Commit ${includedRows.length} games`}
                </button>
              </div>
            </div>

            {isAdmin && (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={overwriteScores}
                  onChange={(event) => setOverwriteScores(event.target.checked)}
                />{' '}
                Overwrite existing scores &amp; statuses (admin only)
              </label>
            )}

            <div className="table-wrap">
              <table className="data-table" aria-label="Schedule import preview rows">
                <thead>
                  <tr>
                    <th>Include</th>
                    <th>Row</th>
                    <th>Action</th>
                    <th>Game #</th>
                    <th>Start (Guam)</th>
                    <th>Matchup</th>
                    <th>Division</th>
                    <th>Phase</th>
                    <th>Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {draftRows.map((row) => {
                    const excluded = excludedIndexes.has(row.rowIndex)
                    return (
                      <tr key={row.rowIndex} style={excluded ? { opacity: 0.45 } : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Include row ${row.rowIndex}`}
                            checked={!excluded}
                            onChange={() => toggleExclude(row.rowIndex)}
                          />
                        </td>
                        <td>{row.rowIndex}</td>
                        <td><StatusBadge status={row.action} /></td>
                        <td>{row.gameNumber || '—'}</td>
                        <td>{row.startTime ? formatGuamDateTime(row.startTime) : 'Invalid'}</td>
                        <td><strong>{row.awayTeam || '?'}</strong> at <strong>{row.homeTeam || '?'}</strong></td>
                        <td>
                          <select
                            aria-label={`Division for row ${row.rowIndex}`}
                            value={row.division || ''}
                            onChange={(event) => updateRowField(row.rowIndex, { division: event.target.value || null })}
                          >
                            <option value="">Unassigned</option>
                            {divisions.map((div) => (
                              <option key={div.id} value={div.name}>{div.name}</option>
                            ))}
                            {row.division && !divisions.some((d) => d.name.toLowerCase() === row.division?.toLowerCase()) && (
                              <option value={row.division}>{row.division} (unknown)</option>
                            )}
                          </select>
                        </td>
                        <td>
                          <select
                            aria-label={`Phase for row ${row.rowIndex}`}
                            value={row.phase}
                            onChange={(event) => updateRowField(row.rowIndex, { phase: event.target.value as GamePhase })}
                          >
                            {PHASE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td>
                          {row.errors.map((msg) => <div key={msg} className="form-error">{msg}</div>)}
                          {row.warnings.map((msg) => <div key={msg} className="muted">{msg}</div>)}
                          {row.errors.length === 0 && row.warnings.length === 0 && 'OK'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}

function RosterImporterPanel({ tournament }: { tournament: Tournament }) {
  const [format, setFormat] = useState<'auto' | 'csv' | 'text'>('auto')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState<RosterImportPreview | null>(null)
  const [draftRows, setDraftRows] = useState<RosterImportRow[]>([])
  const [excludedIndexes, setExcludedIndexes] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [commitResult, setCommitResult] = useState<RosterImportCommitResult | null>(null)

  const includedRows = useMemo(
    () => draftRows.filter((row) => !excludedIndexes.has(row.rowIndex)),
    [draftRows, excludedIndexes],
  )
  const includedErrorCount = useMemo(
    () => includedRows.filter((row) => row.action === 'error' || row.errors.length > 0).length,
    [includedRows],
  )

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 512_000) {
      setError('Roster file exceeds the 500 KB limit.')
      return
    }
    try {
      setContent(await file.text())
      setPreview(null)
      setCommitResult(null)
      setError('')
    } catch {
      setError('Unable to read the selected file.')
    }
  }

  const runPreview = async (structuredRows?: RosterImportRow[]) => {
    setBusy(true)
    setError('')
    setCommitResult(null)
    try {
      const response = await api.adminPreviewRosterImport(
        tournament.id,
        structuredRows ? { rows: structuredRows } : { format, content },
      )
      setPreview(response)
      if (structuredRows) {
        const updatedByIndex = new Map(response.rows.map((row) => [row.rowIndex, row]))
        setDraftRows((current) => current.map((row) => updatedByIndex.get(row.rowIndex) || row))
      } else {
        setDraftRows(response.rows)
        setExcludedIndexes(new Set())
      }
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to preview roster import'))
    } finally {
      setBusy(false)
    }
  }

  const toggleExclude = (rowIndex: number) => {
    setExcludedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) next.delete(rowIndex)
      else next.add(rowIndex)
      return next
    })
  }

  const commit = async () => {
    if (!includedRows.length) return
    setBusy(true)
    setError('')
    try {
      const result = await api.adminCommitRosterImport(tournament.id, { rows: includedRows })
      setCommitResult(result)
      setPreview(null)
      setDraftRows([])
      setExcludedIndexes(new Set())
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to commit roster import'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <Panel>
        <div className="section-heading">
          <div>
            <h2>1. Paste or upload rosters ({tournament.year})</h2>
            <p className="muted">Matches existing teams in this tournament and upserts players idempotently by team + player name.</p>
          </div>
          <button type="button" className="btn secondary small" onClick={() => setContent(SAMPLE_ROSTER_CSV)}>
            Load sample CSV
          </button>
        </div>
        <FormGrid>
          <Field label="Input format">
            <select value={format} onChange={(event) => setFormat(event.target.value as 'auto' | 'csv' | 'text')}>
              <option value="auto">Auto-detect (CSV or Team: blocks)</option>
              <option value="csv">CSV</option>
              <option value="text">Team: header blocks</option>
            </select>
          </Field>
          <Field label="Upload CSV / TXT file">
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => void handleFile(event)} />
          </Field>
        </FormGrid>
        <Field label="Roster CSV or Team: blocks">
          <textarea
            rows={8}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={'team,name,jersey_number,position,nickname\nClass of 2017,John Cruz,23,G,JC'}
          />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row-actions">
          <button type="button" className="btn primary" disabled={busy || !content.trim()} onClick={() => void runPreview()}>
            {busy ? 'Analyzing…' : 'Preview roster import'}
          </button>
        </div>
      </Panel>

      {commitResult && (
        <Panel className="notice-panel">
          <div role="status">
            <strong>Roster import committed.</strong>{' '}
            Created {commitResult.created}, updated {commitResult.updated}, unchanged {commitResult.unchanged}.{' '}
            <Link to={tournamentScopedPath('/admin/divisions', tournament.id)}>View teams &amp; rosters</Link>
          </div>
        </Panel>
      )}

      {preview && (
        <Panel>
          <div className="section-heading">
            <div>
              <h2>2. Review players ({includedRows.length} included of {draftRows.length})</h2>
              <p className="muted">
                Creates: {preview.summary.createCount} · Updates: {preview.summary.updateCount} · Unchanged: {preview.summary.unchangedCount} · Errors: {includedErrorCount}
              </p>
            </div>
            <div className="row-actions">
              <button type="button" className="btn secondary small" disabled={busy} onClick={() => void runPreview(includedRows)}>
                Re-validate rows
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={busy || includedRows.length === 0 || includedErrorCount > 0}
                onClick={() => void commit()}
              >
                {busy ? 'Committing…' : `Commit ${includedRows.length} players`}
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table" aria-label="Roster import preview rows">
              <thead>
                <tr>
                  <th>Include</th>
                  <th>Row</th>
                  <th>Action</th>
                  <th>Team</th>
                  <th>Player</th>
                  <th>Jersey #</th>
                  <th>Pos</th>
                  <th>Messages</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map((row) => {
                  const excluded = excludedIndexes.has(row.rowIndex)
                  return (
                    <tr key={row.rowIndex} style={excluded ? { opacity: 0.45 } : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Include roster row ${row.rowIndex}`}
                          checked={!excluded}
                          onChange={() => toggleExclude(row.rowIndex)}
                        />
                      </td>
                      <td>{row.rowIndex}</td>
                      <td><StatusBadge status={row.action} /></td>
                      <td>{row.team || '—'}</td>
                      <td><strong>{row.name || '—'}</strong></td>
                      <td>{row.jerseyNumber || '—'}</td>
                      <td>{row.position || '—'}</td>
                      <td>{row.errors.length > 0 ? <span className="form-error">{row.errors.join('; ')}</span> : 'OK'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}
