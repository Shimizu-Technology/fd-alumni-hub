'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Newspaper, Calendar, Trash2, ExternalLink } from 'lucide-react'
import { AdminButton, AdminEmptyState, AdminMessage, AdminBadge } from './ui'

type Article = {
  id: string
  title: string
  source: string
  url?: string
  publishedAt: string | null
}

export function AdminNewsList({ initialArticles }: { initialArticles: Article[] }) {
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const router = useRouter()

  const archive = async (id: string) => {
    if (!confirm('Archive this article? This will hide it from the public site.')) return

    setArchivingId(id)
    setMsg(null)

    try {
      const res = await fetch(`/api/admin/articles/${id}/archive`, { method: 'POST' })
      if (!res.ok) throw new Error('Archive failed')
      setMsg({ id, text: 'Archived successfully', ok: true })
      router.refresh()
    } catch {
      setMsg({ id, text: 'Failed to archive', ok: false })
    } finally {
      setArchivingId(null)
    }
  }

  if (initialArticles.length === 0) {
    return (
      <AdminEmptyState
        icon={Newspaper}
        title="No news articles yet"
        description="Add links to tournament coverage from GSPN, Clutch, and other sources."
      />
    )
  }

  return (
    <div className="space-y-2">
      {initialArticles.map((a, index) => {
        const articleMsg = msg?.id === a.id ? msg : null

        return (
          <div
            key={a.id}
            className="group rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 animate-fade-up hover:shadow-md"
            style={{
              borderColor: 'var(--border-subtle)',
              animationDelay: `${index * 30}ms`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <AdminBadge variant="default">{a.source}</AdminBadge>
                  {a.publishedAt && (
                    <span className="flex items-center gap-1.5 text-xs text-[var(--neutral-400)]">
                      <Calendar className="h-3 w-3" />
                      {new Date(a.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                <h3 className="mb-1 font-medium text-[var(--fd-ink)] line-clamp-2 group-hover:text-[var(--fd-maroon)] transition-colors">
                  {a.title}
                </h3>

                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--fd-maroon)] hover:underline"
                  >
                    View article
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <AdminButton
                  onClick={() => archive(a.id)}
                  loading={archivingId === a.id}
                  variant="danger"
                  size="sm"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Archive
                </AdminButton>
                {articleMsg && (
                  <AdminMessage type={articleMsg.ok ? 'success' : 'error'}>
                    {articleMsg.text}
                  </AdminMessage>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
