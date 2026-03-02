'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Article = { id: string; title: string; source: string; publishedAt: string | null }

export function AdminNewsList({ initialArticles }: { initialArticles: Article[] }) {
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const archive = async (id: string) => {
    if (!confirm('Archive/delete this article?')) return
    const res = await fetch(`/api/admin/articles/${id}/archive`, { method: 'POST' })
    if (!res.ok) {
      setMsg('Archive failed')
      return
    }
    setMsg('Archived')
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      {initialArticles.map((a) => (
        <div key={a.id} className="rounded-lg border bg-white p-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-xs text-neutral-500">{a.source} · {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('en-US') : 'No date'}</p>
            </div>
            <button onClick={() => archive(a.id)} className="rounded-lg border px-2 py-1 text-xs text-red-600" style={{ borderColor: 'var(--border-subtle)' }}>Archive</button>
          </div>
        </div>
      ))}
    </div>
  )
}
