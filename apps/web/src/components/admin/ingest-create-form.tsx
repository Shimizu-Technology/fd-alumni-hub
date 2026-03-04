'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidHttpUrl } from '@/lib/url'

export function IngestCreateForm({ tournamentId }: { tournamentId: string }) {
  const [kind, setKind] = useState<'article' | 'media'>('article')
  const [source, setSource] = useState('GSPN')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [confidence, setConfidence] = useState('confirmed')
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!isValidHttpUrl(url) || !isValidHttpUrl(imageUrl)) {
      setMsg('Please provide valid URLs')
      return
    }

    const res = await fetch('/api/admin/ingest/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId,
        kind,
        source,
        title,
        url,
        imageUrl: imageUrl || null,
        excerpt: excerpt || null,
        confidence: confidence || null,
        notes: notes || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg(data?.error || 'Failed to queue item')
      return
    }

    setMsg('Queued for review')
    router.refresh()
    setTitle('')
    setUrl('')
    setImageUrl('')
    setExcerpt('')
    setNotes('')
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold">Queue Content for Review</h2>
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'article' | 'media')} className="rounded-lg border px-2 py-2 text-sm">
          <option value="article">Article</option>
          <option value="media">Media</option>
        </select>
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source" className="rounded-lg border px-2 py-2 text-sm" required />
        <input value={confidence} onChange={(e) => setConfidence(e.target.value)} placeholder="Confidence" className="rounded-lg border px-2 py-2 text-sm" />
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-lg border px-2 py-2 text-sm" required />
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Source URL" className="rounded-lg border px-2 py-2 text-sm" required />
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (optional)" className="rounded-lg border px-2 py-2 text-sm" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Excerpt/Cue (optional)" className="rounded-lg border px-2 py-2 text-sm" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes/Tags (optional)" className="rounded-lg border px-2 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'var(--fd-maroon)' }}>Queue</button>
        {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      </div>
    </form>
  )
}
