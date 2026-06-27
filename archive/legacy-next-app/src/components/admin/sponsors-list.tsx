'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Power, CheckCircle2, XCircle } from 'lucide-react'
import { AdminButton, AdminEmptyState, AdminMessage } from './ui'

type Sponsor = {
  id: string
  name: string
  tier: string | null
  active: boolean
  logoUrl?: string | null
  targetUrl?: string | null
}

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  platinum: { bg: '#f3e8ff', text: '#7c3aed' },
  gold: { bg: '#fef3c7', text: '#d97706' },
  silver: { bg: '#f1f5f9', text: '#64748b' },
  bronze: { bg: '#fed7aa', text: '#c2410c' },
  supporter: { bg: '#ecfdf5', text: '#059669' },
}

export function AdminSponsorsList({ initialSponsors }: { initialSponsors: Sponsor[] }) {
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const router = useRouter()

  const archive = async (id: string) => {
    setArchivingId(id)
    setMsg(null)

    try {
      const res = await fetch(`/api/admin/sponsors/${id}/archive`, { method: 'POST' })
      if (!res.ok) throw new Error('Deactivation failed')
      setMsg({ id, text: 'Sponsor deactivated', ok: true })
      router.refresh()
    } catch {
      setMsg({ id, text: 'Failed to deactivate', ok: false })
    } finally {
      setArchivingId(null)
      setConfirmingId(null)
    }
  }

  if (initialSponsors.length === 0) {
    return (
      <AdminEmptyState
        icon={Heart}
        title="No sponsors yet"
        description="Add tournament sponsors to display on the public site."
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {initialSponsors.map((s, index) => {
        const sponsorMsg = msg?.id === s.id ? msg : null
        const tierStyle = s.tier ? TIER_COLORS[s.tier.toLowerCase()] : null

        return (
          <div
            key={s.id}
            className="group rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 animate-fade-up hover:shadow-md"
            style={{
              borderColor: s.active ? 'var(--border-subtle)' : 'var(--neutral-200)',
              opacity: s.active ? 1 : 0.7,
              animationDelay: `${index * 30}ms`,
            }}
          >
            {/* Logo placeholder */}
            {s.logoUrl ? (
              <div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-[var(--neutral-50)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.logoUrl}
                  alt={s.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-[var(--neutral-50)]">
                <Heart className="h-8 w-8 text-[var(--neutral-300)]" />
              </div>
            )}

            {/* Name + Status */}
            <div className="mb-3">
              <h3 className="font-semibold text-[var(--fd-ink)] group-hover:text-[var(--fd-maroon)] transition-colors">
                {s.name}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.tier && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      background: tierStyle?.bg ?? 'var(--neutral-100)',
                      color: tierStyle?.text ?? 'var(--neutral-600)',
                    }}
                  >
                    {s.tier}
                  </span>
                )}
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-[var(--neutral-100)] text-[var(--neutral-500)]'
                  }`}
                >
                  {s.active ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Inactive
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
              {s.targetUrl ? (
                <a
                  href={s.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-[var(--fd-maroon)] hover:underline"
                >
                  Visit website →
                </a>
              ) : (
                <span className="text-xs text-[var(--neutral-400)]">No website</span>
              )}

              {s.active && (
                confirmingId === s.id ? (
                  <div className="flex items-center gap-2">
                    <AdminButton
                      onClick={() => archive(s.id)}
                      loading={archivingId === s.id}
                      variant="danger"
                      size="sm"
                    >
                      Confirm
                    </AdminButton>
                    <AdminButton
                      onClick={() => setConfirmingId(null)}
                      disabled={archivingId === s.id}
                      variant="secondary"
                      size="sm"
                    >
                      Cancel
                    </AdminButton>
                  </div>
                ) : (
                  <AdminButton
                    onClick={() => setConfirmingId(s.id)}
                    loading={archivingId === s.id}
                    variant="danger"
                    size="sm"
                  >
                    <Power className="h-3.5 w-3.5" />
                    Deactivate
                  </AdminButton>
                )
              )}
            </div>

            {sponsorMsg && (
              <div className="mt-2">
                <AdminMessage type={sponsorMsg.ok ? 'success' : 'error'}>
                  {sponsorMsg.text}
                </AdminMessage>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
