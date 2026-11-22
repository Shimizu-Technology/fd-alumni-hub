import { useId, useRef, useState } from 'react'
import { ErrorState, LoadingState } from '../../../components/ui'
import { api } from '../../../lib/api'
import {
  boxScoreCoverageLabels, boxScoreMetrics, type AdminBoxScore, type BoxScoreCoverage,
  type BoxScoreEntry, type BoxScoreMetric, type BoxScoreUpdate,
} from '../../../lib/boxScores'
import { mutationErrorMessage } from '../../../lib/errors'
import { useAsync } from '../../../lib/hooks'
import type { Game, RosterEntry } from '../../../lib/types'

const statusLabels = { draft: 'Draft', published: 'Published', needs_review: 'Needs review' }

export function BoxScoreEditor({ game, canEdit, canPublish, onSaved }: {
  game: Game
  canEdit: boolean
  canPublish: boolean
  onSaved: (game: Game) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const status = game.boxScoreStatus ?? 'none'
  return (
    <section className="box-score-editor">
      <div className="box-score-actions">
        <button className="btn secondary small" type="button" aria-controls={contentId} aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}>
          {status === 'none' ? 'Add player stats' : canEdit || canPublish ? 'Edit player stats' : 'View player stats'}
        </button>
        {status !== 'none' && <span className="scorekeeper-chip">{statusLabels[status]}</span>}
      </div>
      <div id={contentId} hidden={!expanded}>
        {expanded && <LoadedEditor game={game} canEdit={canEdit} canPublish={canPublish} onSaved={onSaved} />}
      </div>
    </section>
  )
}

function LoadedEditor({ game, canEdit, canPublish, onSaved }: {
  game: Game
  canEdit: boolean
  canPublish: boolean
  onSaved: (game: Game) => void
}) {
  const { data, error, reload } = useAsync(() => api.adminGameBoxScore(game.id), [game.id])
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState label="Loading rosters and player stats" />
  return <EditorForm game={game} initial={data} canEdit={canEdit} canPublish={canPublish} onSaved={onSaved} />
}

function entriesFrom(box: AdminBoxScore) {
  return Object.fromEntries(box.stats.map((stat) => {
    const { rosterEntryId, notes } = stat
    const metrics = Object.fromEntries(boxScoreMetrics.map(({ key }) => [key, stat[key]]))
    return [rosterEntryId, { ...metrics, rosterEntryId, notes }]
  }))
}

function EditorForm({ game, initial, canEdit, canPublish, onSaved }: {
  game: Game
  initial: AdminBoxScore
  canEdit: boolean
  canPublish: boolean
  onSaved: (game: Game) => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const focusPlayerId = useRef<string | null>(null)
  const [box, setBox] = useState(initial)
  const [coverage, setCoverage] = useState<BoxScoreCoverage>(initial.boxScoreCoverage ?? 'selected_scorers')
  const [mode, setMode] = useState<'quick' | 'full'>(
    initial.boxScoreCoverage === 'full_box_score' || initial.stats.some((stat) =>
      stat.notes || boxScoreMetrics.slice(1).some(({ key }) => stat[key] != null)) ? 'full' : 'quick',
  )
  const [rows, setRows] = useState<Record<string, BoxScoreEntry>>(() => entriesFrom(initial))
  const [dirty, setDirty] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>()
  const latestGame = (game.lockVersion ?? 0) >= (box.game.lockVersion ?? 0) ? game : box.game
  const status = latestGame.boxScoreStatus ?? box.boxScoreStatus
  const published = status === 'published' || status === 'needs_review'
  const writable = box.enablePlayerStats && (canPublish || (canEdit && !published))
  const teams = [
    { label: `Home · ${latestGame.homeTeam?.displayName || 'Home team'}`, roster: box.homeRoster, official: latestGame.homeScore },
    { label: `Away · ${latestGame.awayTeam?.displayName || 'Away team'}`, roster: box.awayRoster, official: latestGame.awayScore },
  ].map((team) => ({
    ...team,
    points: team.roster.reduce((sum, player) => sum + (rows[player.id]?.remove ? 0 : Number(rows[player.id]?.points || 0)), 0),
  }))

  function update(player: RosterEntry, change: Partial<BoxScoreEntry>) {
    setRows((current) => ({
      ...current, [player.id]: { ...current[player.id], rosterEntryId: player.id, remove: false, ...change },
    }))
    setDirty((current) => current.includes(player.id) ? current : [...current, player.id])
    setFeedback(undefined)
  }

  async function save(status: BoxScoreUpdate['status']) {
    if (!form.current?.reportValidity()) return
    setBusy(true)
    setFeedback(undefined)
    try {
      const result = await api.adminSaveGameBoxScore(game.id, { status, coverage, entries: dirty.map((id) => rows[id]) })
      setBox(result)
      setRows(entriesFrom(result))
      setDirty([])
      setFeedback({ text: status === 'published' ? 'Box score published.' : published ? 'Box score unpublished and saved as a draft.' : 'Box score draft saved.' })
      onSaved(result.game)
    } catch (error) {
      setFeedback({ error: true, text: mutationErrorMessage(error, 'Could not save player stats.') })
    } finally {
      setBusy(false)
    }
  }

  function statInput(player: RosterEntry, key: BoxScoreMetric, label: string, max: number) {
    return <input type="number" min={0} max={max} step={1} inputMode="numeric"
      aria-label={`${label} for ${player.name}`} value={rows[player.id]?.[key] ?? ''}
      ref={(input) => {
        if (input && key === 'points' && player.id === focusPlayerId.current) {
          focusPlayerId.current = null
          input.focus()
        }
      }}
      onChange={(event) => update(player, { [key]: event.target.value })} />
  }

  const searchTerm = search.trim().replace(/^#/, '').toLowerCase()
  const hasDiscrepancy = teams.some(({ points, official }) =>
    coverage === 'full_box_score' ? points !== official : official !== null && points > official)

  return (
    <form className="box-score-form" ref={form} onSubmit={(event) => event.preventDefault()}>
      <p className="form-note">Player stats never change the official game score or standings.</p>
      <fieldset disabled={busy} className="box-score-fields">
        <div className="box-score-actions" role="group" aria-label="Player stat entry mode">
          <button type="button" className="btn secondary small" aria-pressed={mode === 'quick'} onClick={() => setMode('quick')}>Quick points only</button>
          <button type="button" className="btn secondary small" aria-pressed={mode === 'full'} onClick={() => setMode('full')}>Full box score</button>
        </div>
        <label className="box-score-field">Coverage
          <select value={coverage} disabled={!writable} onChange={(event) => setCoverage(event.target.value as BoxScoreCoverage)}>
            {Object.entries(boxScoreCoverageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className={hasDiscrepancy ? 'box-score-totals box-score-warning' : 'box-score-totals'} aria-live="polite">
          {teams.map(({ label, official, points }) => (
            <div key={label}><strong>{label}</strong><span>{points} player points · {official ?? '—'} official</span></div>
          ))}
          {hasDiscrepancy && <p>{coverage === 'full_box_score'
            ? 'Player points must match the official score on both teams to publish a full box score.'
            : 'Player points exceed the official score.'}</p>}
        </div>
        {mode === 'quick' && writable && (
          <label className="box-score-field">Find player by name or jersey
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        )}
        {mode === 'full' && <p className="form-note">All player stat fields are optional.</p>}
        <fieldset disabled={!writable} className="box-score-fields">
          {teams.map(({ label, roster }) => (
            <section key={label}>
              <h3>{label}</h3>
              {mode === 'quick' ? (
                <>
                  {writable && <div className="box-score-actions">
                    {roster.filter((player) => player.active && (!rows[player.id] || rows[player.id].remove) &&
                      (player.name.toLowerCase().includes(searchTerm) || player.jerseyNumber?.toLowerCase().includes(searchTerm))
                    ).map((player) => (
                      <button type="button" className="btn secondary small" key={player.id} onClick={() => {
                        focusPlayerId.current = player.id
                        update(player, { points: '' })
                      }}>
                        {player.jerseyNumber && `#${player.jerseyNumber} `}{player.name}
                      </button>
                    ))}
                  </div>}
                  {roster.filter((player) => rows[player.id] && !rows[player.id].remove).map((player) => (
                    <div className="box-score-quick-row" key={player.id}>
                      <label>{player.name}{statInput(player, 'points', 'Points', 200)}</label>
                      {writable && <button type="button" className="btn secondary small"
                        aria-label={`Remove stats for ${player.name}`}
                        onClick={() => update(player, { ...emptyMetrics, notes: '', remove: true })}>Remove line</button>}
                    </div>
                  ))}
                </>
              ) : (
                <div className="table-wrap box-score-table" tabIndex={0} role="region" aria-label={label}>
                  <table className="data-table" aria-label={label}>
                    <thead><tr><th scope="col">Player</th>
                      {boxScoreMetrics.map(({ key, short, label: metric }) => <th scope="col" key={key} title={metric}>{short}</th>)}
                      <th scope="col">Private notes</th>
                    </tr></thead>
                    <tbody>{roster.map((player) => (
                      <tr key={player.id}><th scope="row">{player.jerseyNumber && `#${player.jerseyNumber} `}{player.name}{!player.active && ' (inactive)'}</th>
                        {boxScoreMetrics.map(({ key, label: metric, max }) => (
                          <td key={key}>{statInput(player, key, metric, max)}</td>
                        ))}
                        <td><input maxLength={500} aria-label={`Private notes for ${player.name}`} value={rows[player.id]?.notes ?? ''}
                          onChange={(event) => update(player, { notes: event.target.value })} /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {!roster.length && <p className="form-note">No roster players yet.</p>}
            </section>
          ))}
        </fieldset>
        <div className="box-score-actions">
          {writable && !published && <button type="button" className="btn secondary small" onClick={() => void save('draft')}>Save draft</button>}
          {writable && canPublish && <>
            <button type="button" className="btn primary small" disabled={hasDiscrepancy}
              onClick={() => void save('published')}>Publish box score</button>
            {published && <button type="button" className="btn secondary small" onClick={() => void save('draft')}>Unpublish</button>}
          </>}
        </div>
      </fieldset>
      {feedback && <p className={feedback.error ? 'form-error' : 'form-note'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    </form>
  )
}

const emptyMetrics = Object.fromEntries(boxScoreMetrics.map(({ key }) => [key, '']))
