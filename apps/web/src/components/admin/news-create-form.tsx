'use client'


function isValidUrl(value: string) {
  if (!value) return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewsCreateForm({ tournamentId }: { tournamentId: string }) {
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('GSPN')
  const [url, setUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!isValidUrl(url) || !isValidUrl(imageUrl)) {
      setMsg('Please provide valid URL fields')
      return
    }

    const res = await fetch('/api/admin/articles/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId,
        title,
        source,
        url,
        imageUrl: imageUrl || null,
        excerpt: excerpt || null,
        publishedAt: publishedAt || null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg(data?.error || 'Failed')
      return
    }
    setMsg('Created successfully')
    router.refresh()
    setTitle('')
    setUrl('')
    setImageUrl('')
    setExcerpt('')
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold">Add News Link</h2>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-lg border px-2 py-2 text-sm" required />
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (GSPN/Clutch/GuamPDN)" className="rounded-lg border px-2 py-2 text-sm" required />
        <input value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} placeholder="Published at (YYYY-MM-DD)" className="rounded-lg border px-2 py-2 text-sm" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Article URL" className="rounded-lg border px-2 py-2 text-sm" required />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (optional)" className="rounded-lg border px-2 py-2 text-sm" />
        <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short excerpt (optional)" className="rounded-lg border px-2 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'var(--fd-maroon)' }}>Create</button>
        {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      </div>
    </form>
  )
}
