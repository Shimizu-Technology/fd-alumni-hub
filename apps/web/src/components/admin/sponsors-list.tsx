'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Sponsor = { id: string; name: string; tier: string | null; active: boolean }

export function AdminSponsorsList({ initialSponsors }: { initialSponsors: Sponsor[] }) {
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const archive = async (id: string) => {
    if (!confirm('Deactivate this sponsor?')) return
    const res = await fetch(`/api/admin/sponsors/${id}/archive`, { method: 'POST' })
    if (!res.ok) {
      setMsg('Archive failed')
      return
    }
    setMsg('Deactivated')
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      {initialSponsors.map((s) => (
        <div key={s.id} className="rounded-lg border bg-white p-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-neutral-500">tier: {s.tier ?? 'n/a'} · active: {s.active ? 'yes' : 'no'}</p>
            </div>
            <button onClick={() => archive(s.id)} className="rounded-lg border px-2 py-1 text-xs text-red-600" style={{ borderColor: 'var(--border-subtle)' }}>Deactivate</button>
          </div>
        </div>
      ))}
    </div>
  )
}
