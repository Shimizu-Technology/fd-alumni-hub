import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { IngestItem, IngestKind, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

export function AdminIngestPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [status, setStatus] = useState('pending')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, ingest] = await Promise.all([api.adminTournaments(), api.adminIngest({ tournamentId: tournamentId || null, status: status || null })])
    return { tournaments: tournaments.tournaments, ingestItems: ingest.ingestItems }
  }, [tournamentId, status])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  if (loading && !data) return <LoadingState label="Loading ingest queue" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Ingest queue" description="Review candidate article and media links before publishing them to the public archive." />
      <Panel className="toolbar-panel"><label><span>Tournament</span><select value={tournament?.id || ''} onChange={(event) => setTournamentId(event.target.value)}>{data?.tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All</option></select></label></Panel>
      <CreateIngestPanel tournaments={data?.tournaments || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>{!data?.ingestItems.length ? <EmptyState title="No ingest items found" /> : <div className="admin-list">{data.ingestItems.map((item) => <IngestRow key={item.id} item={item} onSaved={reload} />)}</div>}</Panel>
    </div>
  )
}

function CreateIngestPanel({ tournaments, selectedTournamentId, onSaved }: { tournaments: Tournament[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const defaultTournamentId = selectedTournamentId || tournaments[0]?.id || ''
  const [form, setForm] = useState({ tournamentId: defaultTournamentId, kind: 'article' as IngestKind, source: 'GSPN', title: '', url: '', imageUrl: '', excerpt: '', notes: '' })
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
      setMessage('Select a tournament before adding a candidate')
      return
    }

    try {
      await api.adminCreateIngest({ ...form, tournamentId, status: 'pending', imageUrl: form.imageUrl || null, excerpt: form.excerpt || null, notes: form.notes || null })
      setForm({ ...form, tournamentId, title: '', url: '', imageUrl: '', excerpt: '', notes: '' })
      setMessage('Ingest item created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create ingest item')
    }
  }

  return <Panel><div className="section-heading"><h2>Add candidate</h2>{message && <span>{message}</span>}</div><form onSubmit={submit}><FormGrid><Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value })}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field><Field label="Kind"><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as IngestKind })}><option value="article">Article</option><option value="media">Media</option></select></Field><Field label="Source"><input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></Field><Field label="Title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field><Field label="URL"><input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} required /></Field><Field label="Image URL"><input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></Field><Field label="Excerpt"><input value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} /></Field></FormGrid><button className="btn primary" type="submit" disabled={!form.tournamentId}>Add candidate</button></form></Panel>
}

function IngestRow({ item, onSaved }: { item: IngestItem; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const approve = async () => {
    setBusy(true)
    setMutationError('')
    try {
      await api.adminApproveIngest(item.id)
      await onSaved()
    } catch (err) {
      setMutationError(mutationErrorMessage(err, 'Unable to approve ingest item'))
    } finally {
      setBusy(false)
    }
  }
  const reject = async () => {
    setBusy(true)
    setMutationError('')
    try {
      await api.adminRejectIngest(item.id)
      await onSaved()
    } catch (err) {
      setMutationError(mutationErrorMessage(err, 'Unable to reject ingest item'))
    } finally {
      setBusy(false)
    }
  }

  return <article className="admin-row-card"><div className="admin-row-head"><div><strong>{item.title}</strong><span>{item.source} · {item.kind}</span></div><StatusBadge status={item.status} /></div><p>{item.excerpt || item.url}</p>{mutationError && <p className="form-error" role="alert">{mutationError}</p>}<div className="row-actions"><a className="btn secondary" href={item.url} target="_blank" rel="noreferrer">Open source</a>{item.status === 'pending' && <><button className="btn primary" onClick={approve} disabled={busy}>{busy ? 'Working' : 'Approve'}</button><button className="btn danger" onClick={reject} disabled={busy}>{busy ? 'Working' : 'Reject'}</button></>}</div></article>
}
