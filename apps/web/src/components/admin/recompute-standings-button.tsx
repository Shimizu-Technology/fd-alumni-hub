'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { AdminButton, AdminMessage } from './ui'

export function RecomputeStandingsButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null)

  const run = async () => {
    const confirmed = window.confirm(
      'Recompute standings now? This will recalculate standings for all teams in the selected tournament.',
    )
    if (!confirmed) return

    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/standings/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        result?: { teams?: number; games?: number }
      }
      if (!res.ok) throw new Error(data?.error || 'Recompute failed')

      setLastRunAt(new Date())
      setMsg({
        text: `Recomputed ${data.result?.teams ?? 0} teams from ${data.result?.games ?? 0} games`,
        ok: true,
      })
      router.refresh()
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to recompute standings', ok: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <AdminButton onClick={run} loading={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Recompute Standings
        </AdminButton>
        {lastRunAt && (
          <p className="text-xs text-neutral-500">
            Last recompute: {lastRunAt.toLocaleTimeString()}
          </p>
        )}
      </div>
      {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
    </div>
  )
}
