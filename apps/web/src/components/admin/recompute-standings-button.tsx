'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { AdminButton, AdminMessage } from './ui'

export function RecomputeStandingsButton({ tournamentId }: { tournamentId: string }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

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
      if (!res.ok) throw new Error(data?.error || 'Recompute failed')
      setMsg({
        text: `Recomputed ${data.result?.teams ?? 0} teams from ${data.result?.games ?? 0} games`,
        ok: true,
      })
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed', ok: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <AdminButton onClick={run} loading={loading}>
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Recompute Standings
      </AdminButton>
      {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
    </div>
  )
}
