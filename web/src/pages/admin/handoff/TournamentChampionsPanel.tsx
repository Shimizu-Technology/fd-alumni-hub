import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, Field, FormGrid, LoadingState, Panel } from '../../../components/ui'
import { api } from '../../../lib/api'
import { mutationErrorMessage } from '../../../lib/errors'
import { useAsync } from '../../../lib/hooks'
import type { TournamentChampion } from '../../../lib/types'

const BRACKETS = {
  overall: 'Overall', maroon: 'Maroon', gold: 'Gold', platinum: 'Platinum', unknown: 'Unknown',
} as const

export function TournamentChampionsPanel({ tournamentId, canView, canConfirm, canPublishRecap, onChanged }: {
  tournamentId: string
  canView: boolean
  canConfirm: boolean
  canPublishRecap: boolean
  onChanged: () => Promise<void>
}) {
  const records = useAsync(() => canView ? api.adminTournamentChampions(tournamentId) : Promise.resolve(null), [tournamentId, canView])
  const teamOptions = useAsync(() => canConfirm ? api.adminChampionTeamOptions(tournamentId) : Promise.resolve(null), [tournamentId, canConfirm])
  const teamListId = useId()
  const [editing, setEditing] = useState<TournamentChampion | 'new' | null>(null)
  const [removing, setRemoving] = useState<TournamentChampion | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function mutate(operation: () => Promise<unknown>, notice: string) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await operation()
      setEditing(null)
      setRemoving(null)
      setMessage(notice)
      await Promise.all([records.reload(), onChanged()])
    } catch (cause) {
      setError(mutationErrorMessage(cause, 'Unable to save champion result'))
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const data = new FormData(event.currentTarget)
    const value = (key: string) => String(data.get(key) ?? '').trim()
    const payload = {
      bracket: value('bracket') as TournamentChampion['bracket'],
      championLabel: value('championLabel'),
      runnerUpLabel: value('runnerUpLabel') || null,
      score: value('score') || null,
      notes: value('notes') || null,
      status: 'completed' as const,
    }
    const candidate = editing
    void mutate(() => candidate === 'new'
      ? api.adminCreateTournamentChampion(tournamentId, payload)
      : api.adminUpdateTournamentChampion(tournamentId, candidate.id, payload), 'Champion confirmed.')
  }

  const champions = records.data?.champions ?? []
  const confirmed = champions.some((record) => record.status === 'completed')
  const record = editing === 'new' ? null : editing

  return (
    <Panel className="page-stack">
      <div className="section-heading">
        <h2>Division champions</h2>
        {canConfirm && !editing && <button className="btn primary small" type="button" disabled={busy} onClick={() => {
          setError('')
          setRemoving(null)
          setEditing('new')
        }}>Confirm a division champion</button>}
      </div>
      {canView && records.error && <ErrorState message={records.error} onRetry={records.reload} />}
      {canView && records.loading && !records.data && <LoadingState label="Loading division champions" />}
      {canView && records.data && !champions.length && <p className="muted">No champion records have been entered for this tournament.</p>}
      {champions.length > 0 && <ul className="handoff-list">
        {champions.map((champion) => (
          <li className="compact-admin-row" key={champion.id}>
            <div>
              <strong>{BRACKETS[champion.bracket]}{champion.editionLabel && ` · ${champion.editionLabel}`}</strong>
              <p>{champion.championLabel || champion.status.replace('_', ' ')}{champion.runnerUpLabel && ` · Runner-up ${champion.runnerUpLabel}`}{champion.score && ` · ${champion.score}`}</p>
              {champion.notes && <p className="muted">{champion.notes}</p>}
            </div>
            {champion.tournamentId === null && <p className="muted">Historical record</p>}
            {canConfirm && champion.tournamentId !== null && <div className="row-actions">
              <button className="btn secondary small" type="button" disabled={busy} onClick={() => {
                setError('')
                setRemoving(null)
                setEditing(champion)
              }} aria-label={`Edit ${BRACKETS[champion.bracket]} champion`}>Edit</button>
              <button className="btn secondary small" type="button" disabled={busy} onClick={() => {
                setError('')
                setEditing(null)
                setRemoving(champion)
              }} aria-label={`Remove ${BRACKETS[champion.bracket]} champion`}>Remove</button>
            </div>}
          </li>
        ))}
      </ul>}
      {canConfirm && editing && (
        <form key={record?.id ?? 'new'} onSubmit={submit}>
          <h3>{record ? 'Edit division result' : 'Confirm a division champion'}</h3>
          <FormGrid>
            <Field label="Bracket">
              <select name="bracket" defaultValue={record?.bracket ?? 'overall'}>
                {Object.entries(BRACKETS).filter(([key]) => key !== 'unknown' || record?.bracket === key)
                  .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </Field>
            <Field label="Champion"><input name="championLabel" list={teamListId} defaultValue={record?.championLabel ?? ''} required /></Field>
            <Field label="Runner-up"><input name="runnerUpLabel" list={teamListId} defaultValue={record?.runnerUpLabel ?? ''} /></Field>
            <Field label="Score"><input name="score" defaultValue={record?.score ?? ''} placeholder="75–68" /></Field>
            <Field label="Notes"><textarea name="notes" defaultValue={record?.notes ?? ''} rows={2} /></Field>
          </FormGrid>
          <datalist id={teamListId}>{teamOptions.data?.teams.map((team) => <option key={team} value={team} />)}</datalist>
          {teamOptions.error && <p className="muted">Team suggestions are unavailable. Enter the team name directly.</p>}
          <div className="row-actions">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save champion'}</button>
            <button className="btn secondary" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}
      {removing && <div className="state-card">
        <p>Remove {removing.championLabel || 'the result'} from {BRACKETS[removing.bracket]} champion records?</p>
        <div className="row-actions">
          <button className="btn danger" type="button" disabled={busy} onClick={() => void mutate(
            () => api.adminDeleteTournamentChampion(tournamentId, removing.id), 'Champion removed.',
          )}>Confirm removal</button>
          <button className="btn secondary" type="button" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button>
        </div>
      </div>}
      {message && <p role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {confirmed && (canPublishRecap
        ? <div><Link className="btn secondary" to={`/admin/site-mode?mode=tournament_recap&tournamentId=${tournamentId}`}>Publish tournament recap</Link></div>
        : <p className="muted">A Site Mode publisher can preview and publish the tournament recap.</p>)}
    </Panel>
  )
}
