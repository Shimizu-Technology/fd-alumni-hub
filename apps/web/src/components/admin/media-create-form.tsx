'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidHttpUrl } from '@/lib/url'

export function MediaCreateForm({ tournamentId }: { tournamentId: string }) {
  const [source, setSource] = useState('GSPN')
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [articleUrl, setArticleUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('')
  const [takenAt, setTakenAt] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if (!isValidHttpUrl(imageUrl) || !isValidHttpUrl(articleUrl)) {
      setMsg('Please provide valid URLs')
      return
    }

    const res = await fetch('/api/admin/media/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId,
        source,
        title,
        imageUrl,
        articleUrl: articleUrl || null,
        caption: caption || null,
        tags: tags || null,
        takenAt: takenAt || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg(data?.error || 'Failed to create media item')
      return
    }

    setMsg('Media item added')
    router.refresh()
    setTitle('')
    setImageUrl('')
    setArticleUrl('')
    setCaption('')
    setTags('')
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold">Add Media Asset</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (GSPN/Clutch/GuamPDN)" className="rounded-lg border px-2 py-2 text-sm" required />
        <input value={takenAt} onChange={(e) => setTakenAt(e.target.value)} placeholder="Taken at (YYYY-MM-DD)" className="rounded-lg border px-2 py-2 text-sm" />
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-lg border px-2 py-2 text-sm" required />
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" className="rounded-lg border px-2 py-2 text-sm" required />
        <input value={articleUrl} onChange={(e) => setArticleUrl(e.target.value)} placeholder="Article URL (optional)" className="rounded-lg border px-2 py-2 text-sm" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" className="rounded-lg border px-2 py-2 text-sm" />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" className="rounded-lg border px-2 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'var(--fd-maroon)' }}>Create</button>
        {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      </div>
    </form>
  )
}
