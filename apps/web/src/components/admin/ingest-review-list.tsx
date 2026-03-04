'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Item = {
  id: string
  kind: 'article' | 'media'
  status: 'pending' | 'approved' | 'rejected'
  source: string
  title: string
  url: string
  imageUrl: string | null
  excerpt: string | null
  confidence: string | null
  createdAt: string | Date
}

export function IngestReviewList({ items }: { items: Item[] }) {
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const action = async (id: string, type: 'approve' | 'reject') => {
    const res = await fetch(`/api/admin/ingest/${id}/${type}`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg(data?.error || `${type} failed`)
      return
    }
    setMsg(type === 'approve' ? 'Approved and imported' : 'Rejected')
    router.refresh()
  }

  if (!items.length) {
    return <div className="rounded-xl border bg-white p-4 text-sm text-neutral-600" style={{ borderColor: 'var(--border-subtle)' }}>No queued items.</div>
  }

  return (
    <div className="space-y-2">
      {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      {items.map((i) => (
        <article key={i.id} className="rounded-lg border bg-white p-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-neutral-500">{i.kind} · {i.source} · {i.status}</p>
              <p className="font-medium mt-1">{i.title}</p>
              <a href={i.url} target="_blank" rel="noreferrer" className="text-xs underline text-neutral-600 break-all">{i.url}</a>
              {i.excerpt ? <p className="mt-1 text-xs text-neutral-600">{i.excerpt}</p> : null}
              <p className="mt-1 text-[11px] text-neutral-500">confidence: {i.confidence ?? 'unknown'}</p>
            </div>
            {i.status === 'pending' ? (
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => action(i.id, 'approve')} className="rounded-md px-2 py-1 text-xs text-white" style={{ background: 'var(--fd-maroon)' }}>Approve</button>
                <button onClick={() => action(i.id, 'reject')} className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: 'var(--border-subtle)' }}>Reject</button>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}
