import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import type { Sponsor, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'

type SponsorForm = { tournamentId?: string; name: string; logoUrl: string; targetUrl: string; tier: string; active: boolean; position: string }

export function AdminSponsorsPage() {
  const [tournamentId, setTournamentId] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, sponsors] = await Promise.all([api.adminTournaments(), api.adminSponsors(tournamentId || null)])
    return { tournaments: tournaments.tournaments, sponsors: sponsors.sponsors }
  }, [tournamentId])

  if (loading && !data) return <LoadingState label="Loading sponsors" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Sponsors" description="Manage approved sponsor placements and partner links." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournamentId} onChange={setTournamentId} />
      <CreateSponsorPanel tournaments={data?.tournaments || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>{!data?.sponsors.length ? <EmptyState title="No sponsors found" /> : <div className="admin-list">{data.sponsors.map((sponsor) => <SponsorRow key={sponsor.id} sponsor={sponsor} onSaved={reload} />)}</div>}</Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All tournaments</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function CreateSponsorPanel({ tournaments, selectedTournamentId, onSaved }: { tournaments: Tournament[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<SponsorForm>({ tournamentId: selectedTournamentId || tournaments[0]?.id || '', name: '', logoUrl: '', targetUrl: '', tier: 'Community Partner', active: true, position: '0' })
  const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.adminCreateSponsor(cleanSponsor(form))
      setForm({ ...form, name: '', logoUrl: '', targetUrl: '' })
      setMessage('Sponsor created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create sponsor')
    }
  }

  return <Panel><div className="section-heading"><h2>Add sponsor</h2>{message && <span>{message}</span>}</div><form onSubmit={submit}><SponsorFields form={form} setForm={setForm} tournaments={tournaments} includeTournament /><button className="btn primary" type="submit">Create sponsor</button></form></Panel>
}

function SponsorRow({ sponsor, onSaved }: { sponsor: Sponsor; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<SponsorForm>({ name: sponsor.name, logoUrl: sponsor.logoUrl || '', targetUrl: sponsor.targetUrl || '', tier: sponsor.tier || '', active: sponsor.active, position: String(sponsor.position) })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      await api.adminUpdateSponsor(sponsor.id, cleanSponsor(form))
      await onSaved()
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!confirm('Delete this sponsor?')) return
    await api.adminDeleteSponsor(sponsor.id)
    await onSaved()
  }

  return <article className="admin-row-card sponsor-admin-row">{sponsor.logoUrl && <img src={sponsor.logoUrl} alt="" loading="lazy" />}<SponsorFields form={form} setForm={setForm} /><div className="row-actions"><button className="btn secondary" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save'}</button><button className="btn danger" onClick={remove}>Delete</button></div></article>
}

function SponsorFields({ form, setForm, tournaments, includeTournament = false }: { form: SponsorForm; setForm: Dispatch<SetStateAction<SponsorForm>>; tournaments?: Tournament[]; includeTournament?: boolean }) {
  return <FormGrid>{includeTournament && tournaments && <Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value })}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field>}<Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field><Field label="Tier"><input value={form.tier} onChange={(event) => setForm({ ...form, tier: event.target.value })} /></Field><Field label="Logo URL"><input value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} /></Field><Field label="Target URL"><input value={form.targetUrl} onChange={(event) => setForm({ ...form, targetUrl: event.target.value })} /></Field><Field label="Position"><input type="number" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></Field><label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label></FormGrid>
}

function cleanSponsor(form: SponsorForm) {
  return { ...form, logoUrl: form.logoUrl || null, targetUrl: form.targetUrl || null, tier: form.tier || null, position: Number(form.position || 0) }
}
