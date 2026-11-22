import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { api } from '../../lib/api'
import { useAuthContext } from '../../contexts/AuthContext'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { normalizeSponsorTier, SPONSOR_TIER_OPTIONS } from '../../lib/sponsors'
import { normalizeHttpsInput, safeHttpsHref } from '../../lib/urls'
import type { Sponsor, SponsorTier, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'
import { ImageUrlUploadField } from '../../components/admin/ImageUrlUploadField'

type SponsorForm = {
  tournamentId?: string
  name: string
  logoUrl: string
  targetUrl: string
  tier: SponsorTier
  description: string
  active: boolean
  position: string
}

export function AdminSponsorsPage() {
  const auth = useAuthContext()
  const isAdmin = Boolean(auth.user?.isAdmin)
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, sponsors] = await Promise.all([api.adminTournaments(), api.adminSponsors(tournamentId || null)])
    return { tournaments: tournaments.tournaments, sponsors: sponsors.sponsors }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  if (loading && !data) return <LoadingState label="Loading sponsors" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Sponsors" description="Manage approved sponsor tiers, descriptions, logos, and partner links." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      <CreateSponsorPanel tournaments={data?.tournaments || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>{!data?.sponsors.length ? <EmptyState title="No sponsors found" /> : <div className="admin-list">{data.sponsors.map((sponsor) => <SponsorRow key={sponsor.id} sponsor={sponsor} isAdmin={isAdmin} onSaved={reload} />)}</div>}</Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function CreateSponsorPanel({ tournaments, selectedTournamentId, onSaved }: { tournaments: Tournament[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const defaultTournamentId = selectedTournamentId || tournaments[0]?.id || ''
  const [form, setForm] = useState<SponsorForm>({
    tournamentId: defaultTournamentId,
    name: '',
    logoUrl: '',
    targetUrl: '',
    tier: 'community',
    description: '',
    active: true,
    position: '0',
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!defaultTournamentId) return

    setForm((current) => {
      if (current.tournamentId === defaultTournamentId) return current
      if (selectedTournamentId || !current.tournamentId) return { ...current, tournamentId: defaultTournamentId }
      return current
    })
  }, [defaultTournamentId, selectedTournamentId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    const tournamentId = form.tournamentId || defaultTournamentId
    if (!tournamentId) {
      setMessage('Select a tournament before creating a sponsor')
      return
    }

    const cleaned = prepareSponsorPayload({ ...form, tournamentId })
    if (!cleaned.ok) {
      setMessage(cleaned.error)
      return
    }

    try {
      await api.adminCreateSponsor(cleaned.payload)
      setForm({ ...form, tournamentId, name: '', logoUrl: '', targetUrl: '', description: '' })
      setMessage('Sponsor created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create sponsor')
    }
  }

  return <Panel><div className="section-heading"><h2>Add sponsor</h2>{message && <span role="status">{message}</span>}</div><form onSubmit={submit}><SponsorFields form={form} setForm={setForm} tournaments={tournaments} includeTournament /><button className="btn primary" type="submit" disabled={!form.tournamentId}>Create sponsor</button></form></Panel>
}

function SponsorRow({ sponsor, isAdmin, onSaved }: { sponsor: Sponsor; isAdmin: boolean; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<SponsorForm>(() => sponsorToForm(sponsor))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mutationError, setMutationError] = useState('')

  useEffect(() => {
    setForm(sponsorToForm(sponsor))
  }, [sponsor.id, sponsor.updatedAt])

  const save = async () => {
    setSaving(true)
    setMutationError('')
    const cleaned = prepareSponsorPayload(form)
    if (!cleaned.ok) {
      setMutationError(cleaned.error)
      setSaving(false)
      return
    }
    try {
      await api.adminUpdateSponsor(sponsor.id, cleaned.payload)
      await onSaved()
    } catch (err) {
      setMutationError(mutationErrorMessage(err, 'Unable to save sponsor'))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!confirm('Delete this sponsor?')) return
    setDeleting(true)
    setMutationError('')
    try {
      await api.adminDeleteSponsor(sponsor.id)
      await onSaved()
    } catch (err) {
      setMutationError(mutationErrorMessage(err, 'Unable to delete sponsor'))
    } finally {
      setDeleting(false)
    }
  }

  const previewLogo = safeHttpsHref(sponsor.logoUrl)

  return (
    <article className="admin-row-card sponsor-admin-row">
      {previewLogo && <img src={previewLogo} alt="" loading="lazy" />}
      <SponsorFields form={form} setForm={setForm} />
      {mutationError && <p className="form-error" role="alert">{mutationError}</p>}
      <div className="row-actions">
        <button className="btn secondary" onClick={save} disabled={saving || deleting}>{saving ? 'Saving' : 'Save'}</button>
        {isAdmin && <button className="btn danger" onClick={remove} disabled={saving || deleting}>{deleting ? 'Deleting' : 'Delete'}</button>}
      </div>
    </article>
  )
}

function SponsorFields({ form, setForm, tournaments, includeTournament = false }: { form: SponsorForm; setForm: Dispatch<SetStateAction<SponsorForm>>; tournaments?: Tournament[]; includeTournament?: boolean }) {
  return (
    <FormGrid>
      {includeTournament && tournaments && <Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value })}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field>}
      <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
      <Field label="Tier">
        <select value={form.tier} onChange={(event) => setForm({ ...form, tier: event.target.value as SponsorTier })}>
          {SPONSOR_TIER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </Field>
      <ImageUrlUploadField label="Logo URL" value={form.logoUrl} tournamentId={form.tournamentId} purpose="sponsor-logo" onChange={(logoUrl) => setForm({ ...form, logoUrl })} help="Upload a sponsor logo to S3 or paste a hosted HTTPS logo URL." />
      <Field label="Target URL"><input value={form.targetUrl} onChange={(event) => setForm({ ...form, targetUrl: event.target.value })} placeholder="https://partner.example.com" /></Field>
      <Field label="Position"><input type="number" min={0} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></Field>
      <Field label="Description (optional)">
        <textarea rows={2} maxLength={600} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Short public thank-you or partner note" />
      </Field>
      <label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
    </FormGrid>
  )
}

function sponsorToForm(sponsor: Sponsor): SponsorForm {
  return {
    tournamentId: sponsor.tournamentId,
    name: sponsor.name,
    logoUrl: sponsor.logoUrl || '',
    targetUrl: sponsor.targetUrl || '',
    tier: normalizeSponsorTier(sponsor.tier),
    description: sponsor.description || '',
    active: sponsor.active,
    position: String(sponsor.position),
  }
}

function prepareSponsorPayload(form: SponsorForm): { ok: true; payload: Partial<Sponsor> } | { ok: false; error: string } {
  const normalizedLogo = normalizeHttpsInput(form.logoUrl, 'Logo URL')
  if (!normalizedLogo.ok) return normalizedLogo

  const normalizedTarget = normalizeHttpsInput(form.targetUrl, 'Target URL')
  if (!normalizedTarget.ok) return normalizedTarget

  return {
    ok: true,
    payload: {
      tournamentId: form.tournamentId,
      name: form.name.trim(),
      logoUrl: normalizedLogo.url,
      targetUrl: normalizedTarget.url,
      tier: form.tier,
      description: form.description.trim() || null,
      active: form.active,
      position: Number(form.position || 0),
    },
  }
}
