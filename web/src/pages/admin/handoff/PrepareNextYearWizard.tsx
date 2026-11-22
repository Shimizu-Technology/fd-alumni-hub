import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, Field, FormGrid, LoadingState, Panel } from '../../../components/ui'
import { api } from '../../../lib/api'
import { mutationErrorMessage } from '../../../lib/errors'
import { useAsync } from '../../../lib/hooks'
import type { AdminHostCampaign, CampaignClonePayload, HandoffCampaignSummary } from '../../../lib/types'
import { centsToInput, formatUsd, parseDollarsToCents } from '../finance/financeFields'
import { HandoffOfficers, officerNames } from './HandoffOfficers'

const steps = ['Review carry-forward', 'Create private draft', 'Invite incoming officers']

export function hostYearWorkspace(slug: string, tab: string) {
  return `/admin/campaign/host-year?campaign=${encodeURIComponent(slug)}&tab=${tab}`
}

export function PrepareNextYearWizard({ source, onClose, onCreated }: { source: HandoffCampaignSummary; onClose: () => void; onCreated: () => Promise<void> }) {
  const [payload, setPayload] = useState<CampaignClonePayload | null>(null)
  const [incoming, setIncoming] = useState<AdminHostCampaign | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const step = incoming ? 2 : payload ? 1 : 0

  async function createDraft() {
    if (!payload || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await api.adminCloneCampaign(source.id, payload)
      setIncoming(result.campaign)
      await onCreated()
    } catch (cause) {
      setError(mutationErrorMessage(cause, 'Unable to prepare next year'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="page-stack">
      <div className="section-heading">
        <h2>Prepare next year</h2>
        <button className="btn secondary small" type="button" disabled={busy} onClick={onClose}>{incoming ? 'Done' : 'Close wizard'}</button>
      </div>
      <ol className="handoff-steps">
        {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}>{label}</li>)}
      </ol>
      {incoming ? <InviteIncomingOfficers campaign={incoming} workspaceLoading={busy} /> : (
        <>
          <CarryForwardForm source={source} previous={payload} hidden={Boolean(payload)} onContinue={(next) => {
            setPayload(next)
            setError('')
          }} />
          {payload && <>
            <h3>Create a private draft for Class of {payload.hostClassYear}</h3>
            <p>{payload.title} · {formatUsd(payload.goalCents ?? source.goalCents)} goal. The draft stays private until a campaign administrator publishes it.</p>
            <div className="row-actions handoff-actions">
              <button className="btn secondary" type="button" disabled={busy} onClick={() => {
                setError('')
                setPayload(null)
              }}>Back</button>
              <button className="btn primary" type="button" disabled={busy} onClick={() => void createDraft()}>
                {busy ? 'Creating draft…' : 'Create private draft'}
              </button>
            </div>
          </>}
        </>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Panel>
  )
}

function CarryForwardForm({ source, previous, hidden, onContinue }: {
  source: HandoffCampaignSummary
  previous: CampaignClonePayload | null
  hidden: boolean
  onContinue: (payload: CampaignClonePayload) => void
}) {
  const nextYear = source.tournamentYear + 1
  const nextClass = source.hostClassYear + 1
  const [year, setYear] = useState(previous?.tournament?.year ?? nextYear)
  const [error, setError] = useState('')
  const [copyBudgetCategories, setCopyBudgetCategories] = useState(true)
  const available = useAsync(async () => {
    const [seasons, campaigns] = await Promise.all([api.adminTournaments(), api.adminCampaigns()])
    const occupied = new Set(campaigns.campaigns.map((campaign) => campaign.tournamentId))
    return seasons.tournaments.filter((tournament) => !occupied.has(tournament.id))
  }, [])
  const existing = available.data?.filter((tournament) => tournament.year === year) ?? []

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const value = (key: string) => String(data.get(key) ?? '').trim()
    const goal = parseDollarsToCents(value('goal'), { positive: true })
    if (!goal.ok) {
      setError(goal.error)
      return
    }

    const targetId = value('targetTournamentId')
    const startDate = value('startDate')
    const endDate = value('endDate')
    if (!targetId && (startDate.slice(0, 4) !== String(year) || endDate < startDate)) {
      setError('Choose a start date in the tournament year and an end date on or after it.')
      return
    }
    setError('')
    onContinue({
      targetTournamentId: targetId || null,
      tournament: targetId ? null : { year, name: value('name'), startDate, endDate },
      hostClassYear: Number(value('hostClassYear')),
      title: value('title'),
      slug: value('slug'),
      goalCents: goal.value,
      copyDivisions: data.has('copyDivisions'),
      copyBudgetCategories,
      copyEventTemplates: data.has('copyEventTemplates'),
      copyBudgetAmounts: copyBudgetCategories && data.has('copyBudgetAmounts'),
    })
  }

  return (
    <form hidden={hidden} className={hidden ? undefined : 'page-stack'} onSubmit={submit}>
      <div className="state-card">
        <strong>Outgoing ledger, receipts, pledges, HåfaPass links, and credentials are never copied.</strong>
        <p>FDAA funding assumptions carry forward for the incoming officers to review: {formatUsd(source.fdaaUpfrontCents)} upfront and {source.fdaaTicketShareBps / 100}% of ticket proceeds.</p>
      </div>
      <FormGrid>
        <Field label="Tournament year"><input type="number" min={nextYear} max={2200} required value={year || ''} onChange={(event) => setYear(Number(event.target.value))} /></Field>
        <Field label="Host class graduation year"><input type="number" name="hostClassYear" min={1950} max={2099} required defaultValue={nextClass} /></Field>
        <Field label="Campaign title"><input name="title" maxLength={160} defaultValue={`Class of ${nextClass} Host Year`} required /></Field>
        <Field label="Campaign slug"><input name="slug" pattern="[a-z0-9][a-z0-9\\-]{1,62}[a-z0-9]" defaultValue={`${nextYear}-class-of-${nextClass}`} required /></Field>
        <Field label="Fundraising goal ($)"><input inputMode="decimal" name="goal" defaultValue={centsToInput(source.goalCents)} required /></Field>
      </FormGrid>
      {available.loading && !available.data && <LoadingState label="Checking for an existing tournament" />}
      {available.error && <ErrorState message={available.error} onRetry={available.reload} />}
      {!!existing.length ? (
        <Field label="Existing tournament">
          <select key={year} name="targetTournamentId" required defaultValue={existing[0]?.id}>
            {existing.map((tournament) => <option value={tournament.id} key={tournament.id}>{tournament.name}</option>)}
          </select>
        </Field>
      ) : (
        <FormGrid>
          <Field label="Tournament name"><input name="name" key={year} defaultValue={`FD Alumni Basketball Tournament ${year || nextYear}`} required /></Field>
          <Field label="Start date"><input name="startDate" type="date" required /></Field>
          <Field label="End date"><input name="endDate" type="date" required /></Field>
        </FormGrid>
      )}
      <div className="page-stack">
        <label className="check-field"><input name="copyDivisions" type="checkbox" defaultChecked /> Carry forward divisions</label>
        <label className="check-field">
          <input type="checkbox" checked={copyBudgetCategories} onChange={(event) => setCopyBudgetCategories(event.target.checked)} />
          Carry forward budget categories with zero amounts
        </label>
        {copyBudgetCategories && <label className="check-field">
          <input name="copyBudgetAmounts" type="checkbox" /> Also carry forward the budgeted amounts
        </label>}
        <label className="check-field"><input name="copyEventTemplates" type="checkbox" defaultChecked /> Carry forward private event templates with dates TBD</label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div><button className="btn primary" type="submit" disabled={!available.data || Boolean(available.error)}>Review private draft</button></div>
    </form>
  )
}

function InviteIncomingOfficers({ campaign, workspaceLoading }: { campaign: AdminHostCampaign; workspaceLoading: boolean }) {
  const status = useAsync(() => api.adminCampaignHandoffStatus(campaign.id), [campaign.id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email')).trim()
    const role = data.get('role') === 'treasurer' ? 'treasurer' : 'chair'
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.adminCreateCampaignInvitation(campaign.id, { email, role })
      form.reset()
      setNotice(`Invitation set up for ${email}.`)
      await status.reload()
    } catch (cause) {
      setError(mutationErrorMessage(cause, 'Unable to invite officer'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h3>{campaign.title} draft created</h3>
      <p>Invite the chair and treasurer using the email each officer will verify at sign-in. Share the incoming workspace link with them.</p>
      <form onSubmit={invite}>
        <FormGrid>
          <Field label="Officer role"><select name="role">
            {Object.entries(officerNames).map(([role, name]) => <option key={role} value={role}>{name}</option>)}
          </select></Field>
          <Field label="Officer email"><input name="email" type="email" required /></Field>
        </FormGrid>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Setting up invitation…' : 'Invite officer'}</button>
      </form>
      {notice && <p role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {status.loading && !status.data && <LoadingState label="Loading officer status" />}
      {status.error && <ErrorState message={status.error} onRetry={status.reload} />}
      {status.data && <HandoffOfficers officers={status.data.onboarding?.officers ?? null} />}
      <div className="row-actions handoff-actions">
        {workspaceLoading ? <span role="status">Refreshing campaign list…</span> :
          <Link className="btn secondary" to={hostYearWorkspace(campaign.slug, 'handoff')}>Open incoming year workspace</Link>}
        <button className="btn secondary" type="button" disabled={status.loading} onClick={() => void status.reload()}>Refresh invitation status</button>
      </div>
    </>
  )
}
