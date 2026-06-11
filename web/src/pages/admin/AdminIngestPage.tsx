import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import type { IngestItem, IngestKind, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

export function AdminIngestPage() {
  const [tournamentId, setTournamentId] = useState('')
  const [status, setStatus] = useState('pending')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, ingest] = await Promise.all([api.adminTournaments(), api.adminIngest({ tournamentId: tournamentId || null, status: status || null })])
    return { tournaments: tournaments.tournaments, ingestItems: ingest.ingestItems }
  }, [tournamentId, status])

  if (loading && !data) return <LoadingState label="Loading ingest queue" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Ingest queue" description="Review candidate article and media links before publishing them to the public archive." />
      <Panel className="toolbar-panel"><label><span>Tournament</span><select value={tournamentId} onChange={(event) => setTournamentId(event.target.value)}><option value="">All tournaments</option>{data?.tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All</option></select></label></Panel>
      <CreateIngestPanel tournaments={data?.tournaments || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>{!data?.ingestItems.length ? <EmptyState title="No ingest items found" /> : <div className="admin-list">{data.ingestItems.map((item) => <IngestRow key={item.id} item={item} onSaved={reload} />)}</div>}</Panel>
    </div>
  )
}

function CreateIngestPanel({ tournaments, selectedTournamentId, onSaved }: { tournaments: Tournament[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ tournamentId: selectedTournamentId || tournaments[0]?.id || '', kind: 'article' as IngestKind, source: 'GSPN', title: '', url: '', imageUrl: '', excerpt: '', notes: '' })
  const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.adminCreateIngest({ ...form, status: 'pending', imageUrl: form.imageUrl || null, excerpt: form.excerpt || null, notes: form.notes || null })
      setForm({ ...form, title: '', url: '', imageUrl: '', excerpt: '', notes: '' })
      setMessage('Ingest item created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create ingest item')
    }
  }

  return <Panel><div className="section-heading"><h2>Add candidate</h2>{message && <span>{message}</span>}</div><form onSubmit={submit}><FormGrid><Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value })}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field><Field label="Kind"><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as IngestKind })}><option value="article">Article</option><option value="media">Media</option></select></Field><Field label="Source"><input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></Field><Field label="Title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field><Field label="URL"><input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} required /></Field><Field label="Image URL"><input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></Field><Field label="Excerpt"><input value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} /></Field></FormGrid><button className="btn primary" type="submit">Add candidate</button></form></Panel>
}

function IngestRow({ item, onSaved }: { item: IngestItem; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const approve = async () => {
    setBusy(true)
    try {
      await api.adminApproveIngest(item.id)
      await onSaved()
    } finally {
      setBusy(false)
    }
  }
  const reject = async () => {
    setBusy(true)
    try {
      await api.adminRejectIngest(item.id)
      await onSaved()
    } finally {
      setBusy(false)
    }
  }

  return <article className="admin-row-card"><div className="admin-row-head"><div><strong>{item.title}</strong><span>{item.source} · {item.kind}</span></div><StatusBadge status={item.status} /></div><p>{item.excerpt || item.url}</p><div className="row-actions"><a className="btn secondary" href={item.url} target="_blank" rel="noreferrer">Open source</a>{item.status === 'pending' && <><button className="btn primary" onClick={approve} disabled={busy}>Approve</button><button className="btn danger" onClick={reject} disabled={busy}>Reject</button></>}</div></article>
}
