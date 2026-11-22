import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { tournamentScopedPath } from '../../lib/admin'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { AdminHostCampaign, Division, Tournament } from '../../lib/types'
import { ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'

type DivisionDraft = {
  name: string
  position: number
  countsForStandings: boolean
}

const DEFAULT_DIVISIONS: DivisionDraft[] = [
  { name: 'Maroon', position: 1, countsForStandings: true },
  { name: 'Gold', position: 2, countsForStandings: true },
  { name: 'Platinum', position: 3, countsForStandings: true },
  { name: 'Special', position: 4, countsForStandings: false },
]

export function AdminTournamentWizardPage() {
  const { data, loading, error, reload } = useAsync(() => api.adminTournaments(), [])
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [initialized, setInitialized] = useState(false)

  const [name, setName] = useState('FD Alumni Basketball Tournament')
  const [year, setYear] = useState(String(new Date().getFullYear() + 1))
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [divisions, setDivisions] = useState<DivisionDraft[]>(DEFAULT_DIVISIONS)
  const [newDivisionName, setNewDivisionName] = useState('')
  const [newDivisionCounts, setNewDivisionCounts] = useState(true)

  const [createCampaign, setCreateCampaign] = useState(true)
  const [hostClassYear, setHostClassYear] = useState('')
  const [campaignTitle, setCampaignTitle] = useState('')
  const [campaignSlug, setCampaignSlug] = useState('')
  const [goalDollars, setGoalDollars] = useState('30000')
  const [fdaaUpfrontDollars, setFdaaUpfrontDollars] = useState('0')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [created, setCreated] = useState<{ tournament: Tournament; divisions: Division[]; hostCampaign: AdminHostCampaign | null } | null>(null)

  useEffect(() => {
    if (initialized || !data) return
    const latestYear = data.tournaments.reduce((max, t) => Math.max(max, t.year), new Date().getFullYear())
    const nextYear = latestYear + 1
    setYear(String(nextYear))
    setStartDate(`${nextYear}-07-02`)
    setEndDate(`${nextYear}-07-23`)
    setHostClassYear(String(nextYear - 10))
    setCampaignTitle(`Class of ${nextYear - 10} Host Year (${nextYear})`)
    setCampaignSlug(`${nextYear}-class-of-${nextYear - 10}`)
    setInitialized(true)
  }, [data, initialized])

  if (loading && !data) return <LoadingState label="Preparing setup wizard" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const addDivision = () => {
    const clean = newDivisionName.trim()
    if (!clean) return
    if (divisions.some((d) => d.name.toLowerCase() === clean.toLowerCase())) return
    setDivisions((prev) => [...prev, { name: clean, position: prev.length + 1, countsForStandings: newDivisionCounts }])
    setNewDivisionName('')
    setNewDivisionCounts(true)
  }

  const removeDivision = (index: number) => {
    setDivisions((prev) => prev.filter((_, idx) => idx !== index).map((d, idx) => ({ ...d, position: idx + 1 })))
  }

  const submit = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const numericYear = Number(year)
      const parsedGoalCents = Math.round(Number(goalDollars || '0') * 100)
      const parsedUpfrontCents = Math.round(Number(fdaaUpfrontDollars || '0') * 100)
      const response = await api.adminSetupTournament({
        tournament: {
          name: name.trim(),
          year: numericYear,
          startDate,
          endDate,
          status: 'upcoming',
        },
        divisions: divisions.map((d, idx) => ({
          name: d.name.trim(),
          position: idx + 1,
          countsForStandings: d.countsForStandings,
          active: true,
        })),
        hostCampaign: createCampaign
          ? {
              hostClassYear: Number(hostClassYear),
              title: campaignTitle.trim() || undefined,
              slug: campaignSlug.trim() || undefined,
              goalCents: parsedGoalCents,
              fdaaUpfrontCents: parsedUpfrontCents,
            }
          : null,
      })
      setCreated(response)
    } catch (err) {
      setSaveError(mutationErrorMessage(err, 'Unable to set up tournament'))
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    return (
      <div className="page-stack admin-page">
        <PageHeader
          eyebrow="Tournament Setup Wizard"
          title={`${created.tournament.year} tournament is ready`}
          description="Your tournament, per-tournament divisions, and optional draft host campaign were created atomically."
        />
        <Panel>
          <div className="section-heading">
            <div>
              <h2>{created.tournament.year} · {created.tournament.name}</h2>
              <p className="muted">
                {created.divisions.length} divisions ({created.divisions.map((d) => d.name).join(', ')})
                {created.hostCampaign ? ` · Draft campaign "${created.hostCampaign.title}" (${created.hostCampaign.slug})` : ''}
              </p>
            </div>
          </div>
          <div className="row-actions">
            <Link className="btn primary" to={tournamentScopedPath('/admin/import', created.tournament.id)}>Import schedule &amp; rosters</Link>
            <Link className="btn secondary" to={tournamentScopedPath('/admin/divisions', created.tournament.id)}>Manage teams &amp; divisions</Link>
            <Link className="btn secondary" to="/admin/people">Invite board &amp; staff</Link>
            <Link className="btn secondary" to={`/admin/tournaments/${created.tournament.id}`}>Open tournament dashboard</Link>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin · Setup Wizard"
        title="New tournament setup"
        description="Step through tournament details, per-tournament divisions, and an optional draft Host Class campaign in one atomic action."
        actions={<Link className="btn secondary" to="/admin/tournaments">Back to tournaments</Link>}
      />

      <Panel className="toolbar-panel">
        <div className="row-actions" role="tablist" aria-label="Setup wizard steps">
          {[
            { id: 1 as const, label: '1. Tournament details' },
            { id: 2 as const, label: '2. Divisions' },
            { id: 3 as const, label: '3. Host class campaign' },
            { id: 4 as const, label: '4. Review & create' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={step === item.id}
              className={step === item.id ? 'btn primary small' : 'btn secondary small'}
              onClick={() => setStep(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Panel>

      {step === 1 && (
        <Panel>
          <h2>Step 1 · Tournament details</h2>
          <FormGrid>
            <Field label="Tournament name"><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Year"><input type="number" value={year} onChange={(e) => setYear(e.target.value)} required /></Field>
            <Field label="Start date"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></Field>
            <Field label="End date"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></Field>
          </FormGrid>
          <div className="row-actions">
            <button type="button" className="btn primary" disabled={!name.trim() || !year || !startDate || !endDate} onClick={() => setStep(2)}>
              Next: Divisions
            </button>
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel>
          <h2>Step 2 · Divisions for {year}</h2>
          <p className="muted">Divisions are scoped to this tournament only. Uncheck "Counts for standings" for Special or exhibition divisions.</p>
          <div className="admin-list compact-admin-list">
            {divisions.map((div, idx) => (
              <article className="admin-row-card compact-admin-row" key={`${div.name}-${idx}`}>
                <strong>{idx + 1}. {div.name}</strong>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={div.countsForStandings}
                    onChange={(e) =>
                      setDivisions((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, countsForStandings: e.target.checked } : item)),
                      )
                    }
                  />{' '}
                  Counts for standings
                </label>
                <button type="button" className="btn secondary small" onClick={() => removeDivision(idx)} disabled={divisions.length <= 1}>
                  Remove
                </button>
              </article>
            ))}
          </div>
          <FormGrid>
            <Field label="Add division"><input value={newDivisionName} onChange={(e) => setNewDivisionName(e.target.value)} placeholder="Legends" /></Field>
            <label className="check-field"><input type="checkbox" checked={newDivisionCounts} onChange={(e) => setNewDivisionCounts(e.target.checked)} /> Counts for standings</label>
          </FormGrid>
          <div className="row-actions">
            <button type="button" className="btn secondary" onClick={addDivision} disabled={!newDivisionName.trim()}>Add division</button>
            <button type="button" className="btn secondary" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="btn primary" disabled={divisions.length === 0} onClick={() => setStep(3)}>Next: Host class campaign</button>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel>
          <h2>Step 3 · Host class campaign (optional)</h2>
          <p className="muted">New campaigns always start in draft mode with the public fundraising meter disabled until the board enables it.</p>
          <label className="check-field">
            <input type="checkbox" checked={createCampaign} onChange={(e) => setCreateCampaign(e.target.checked)} />{' '}
            Create a draft Host Class campaign for this tournament
          </label>
          {createCampaign && (
            <FormGrid>
              <Field label="Host class graduation year"><input type="number" value={hostClassYear} onChange={(e) => setHostClassYear(e.target.value)} placeholder="2017" required /></Field>
              <Field label="Campaign title"><input value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} placeholder="Class of 2017 Host Year (2027)" /></Field>
              <Field label="Campaign URL slug"><input value={campaignSlug} onChange={(e) => setCampaignSlug(e.target.value)} placeholder="2027-class-of-2017" /></Field>
              <Field label="Fundraising goal (USD)"><input type="number" min={1} value={goalDollars} onChange={(e) => setGoalDollars(e.target.value)} required /></Field>
              <Field label="FDAA upfront commitment (USD)"><input type="number" min={0} value={fdaaUpfrontDollars} onChange={(e) => setFdaaUpfrontDollars(e.target.value)} /></Field>
            </FormGrid>
          )}
          <div className="row-actions">
            <button type="button" className="btn secondary" onClick={() => setStep(2)}>Back</button>
            <button type="button" className="btn primary" onClick={() => setStep(4)}>Next: Review &amp; create</button>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <Panel>
          <h2>Step 4 · Review &amp; create</h2>
          <dl className="game-detail-summary">
            <div><dt>Tournament</dt><dd>{year} · {name}</dd></div>
            <div><dt>Window</dt><dd>{startDate} → {endDate}</dd></div>
            <div><dt>Divisions</dt><dd>{divisions.map((d) => `${d.name}${d.countsForStandings ? '' : ' (non-standings)'}`).join(', ')}</dd></div>
            <div><dt>Host campaign</dt><dd>{createCampaign ? `Draft · Class of ${hostClassYear} · Goal $${Number(goalDollars || 0).toLocaleString()}` : 'None (create later)'}</dd></div>
          </dl>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <div className="row-actions">
            <button type="button" className="btn secondary" onClick={() => setStep(3)} disabled={saving}>Back</button>
            <button type="button" className="btn primary" onClick={() => void submit()} disabled={saving}>
              {saving ? 'Creating tournament…' : 'Create tournament'}
            </button>
          </div>
        </Panel>
      )}
    </div>
  )
}
