'use client'

import { useState } from 'react'

export function RecomputeStandingsButton({ tournamentId }: { tournamentId: string }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/standings/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setMsg(`Recomputed ${data.result?.teams ?? 0} teams from ${data.result?.games ?? 0} games`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={run} disabled={loading} className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'var(--fd-maroon)' }}>
        {loading ? 'Recomputing…' : 'Recompute Standings'}
      </button>
      {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
    </div>
  )
}
