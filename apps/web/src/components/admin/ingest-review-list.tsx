'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { AdminButton, AdminEmptyState, AdminMessage, AdminBadge } from './ui'

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

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
}

export function IngestReviewList({ items }: { items: Item[] }) {
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const router = useRouter()

  const action = async (id: string, type: 'approve' | 'reject') => {
    setActioningId(id)
    setMsg(null)

    try {
      const res = await fetch(`/api/admin/ingest/${id}/${type}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `${type} failed`)
      }
      setMsg({
        id,
        text: type === 'approve' ? 'Approved and imported' : 'Rejected',
        ok: true,
      })
      router.refresh()
    } catch (e) {
      setMsg({ id, text: e instanceof Error ? e.message : `${type} failed`, ok: false })
    } finally {
      setActioningId(null)
    }
  }

  if (!items.length) {
    return (
      <AdminEmptyState
        icon={Inbox}
        title="No queued items"
        description="Content scraped or manually added will appear here for review."
      />
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const itemMsg = msg?.id === item.id ? msg : null
        const status = STATUS_CONFIG[item.status]
        const StatusIcon = status.icon

        return (
          <article
            key={item.id}
            className="rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 animate-fade-up hover:shadow-md"
            style={{
              borderColor: 'var(--border-subtle)',
              animationDelay: `${index * 30}ms`,
            }}
          >
            <div className="flex items-start gap-4">
              {/* Image thumbnail */}
              {item.imageUrl && (
                <div className="hidden sm:block shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-20 w-28 rounded-lg object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="min-w-0 flex-1">
                {/* Badges */}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <AdminBadge variant="default">
                    {item.kind === 'article' ? '📄 Article' : '🖼️ Media'}
                  </AdminBadge>
                  <AdminBadge variant="default">{item.source}</AdminBadge>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.bg} ${status.text}`}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                  {item.confidence && (
                    <span className="text-[10px] text-[var(--neutral-400)]">
                      Confidence: {item.confidence}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="mb-1 font-semibold text-[var(--fd-ink)] line-clamp-2">
                  {item.title}
                </h3>

                {/* URL */}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-2 inline-flex items-center gap-1 text-xs text-[var(--fd-maroon)] hover:underline break-all"
                >
                  {item.url.length > 60 ? `${item.url.slice(0, 60)}…` : item.url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>

                {/* Excerpt */}
                {item.excerpt && (
                  <p className="text-xs text-[var(--neutral-500)] line-clamp-2">
                    {item.excerpt}
                  </p>
                )}

                {/* Feedback message */}
                {itemMsg && (
                  <div className="mt-2">
                    <AdminMessage type={itemMsg.ok ? 'success' : 'error'}>
                      {itemMsg.text}
                    </AdminMessage>
                  </div>
                )}
              </div>

              {/* Actions */}
              {item.status === 'pending' && (
                <div className="flex shrink-0 flex-col gap-2">
                  <AdminButton
                    onClick={() => action(item.id, 'approve')}
                    loading={actioningId === item.id}
                    size="sm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </AdminButton>
                  <AdminButton
                    onClick={() => action(item.id, 'reject')}
                    disabled={actioningId === item.id}
                    variant="danger"
                    size="sm"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </AdminButton>
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
