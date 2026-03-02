'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type GameRow = {
  id: string
  startTime: string
  status: 'scheduled' | 'live' | 'final'
  homeScore: number | null
  awayScore: number | null
  streamUrl: string | null
  ticketUrl: string | null
  homeTeam: { displayName: string }
  awayTeam: { displayName: string }
}

export function GameEditor({ initialGames }: { initialGames: GameRow[] }) {
  const [games, setGames] = useState(initialGames)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const updateGame = (id: string, patch: Partial<GameRow>) => {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }

  const save = async (game: GameRow) => {
    setSavingId(game.id)
    try {
      const res = await fetch(`/api/admin/games/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: game.status,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          streamUrl: game.streamUrl,
          ticketUrl: game.ticketUrl,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setMsg('Saved')
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      {games.map((g) => (
        <div key={g.id} className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="font-medium">{g.awayTeam.displayName} vs {g.homeTeam.displayName}</p>
          <p className="mb-3 text-xs text-neutral-500">{new Date(g.startTime).toLocaleString('en-US')}</p>
          <div className="grid gap-2 sm:grid-cols-5">
            <select value={g.status} onChange={(e) => updateGame(g.id, { status: e.target.value as GameRow['status'] })} className="rounded-lg border px-2 py-2 text-sm">
              <option value="scheduled">scheduled</option>
              <option value="live">live</option>
              <option value="final">final</option>
            </select>
            <input type="number" placeholder="Away" value={g.awayScore ?? ''} onChange={(e) => updateGame(g.id, { awayScore: e.target.value === '' ? null : Number(e.target.value) })} className="rounded-lg border px-2 py-2 text-sm" />
            <input type="number" placeholder="Home" value={g.homeScore ?? ''} onChange={(e) => updateGame(g.id, { homeScore: e.target.value === '' ? null : Number(e.target.value) })} className="rounded-lg border px-2 py-2 text-sm" />
            <input placeholder="Stream URL" value={g.streamUrl ?? ''} onChange={(e) => updateGame(g.id, { streamUrl: e.target.value || null })} className="rounded-lg border px-2 py-2 text-sm" />
            <input placeholder="Ticket URL" value={g.ticketUrl ?? ''} onChange={(e) => updateGame(g.id, { ticketUrl: e.target.value || null })} className="rounded-lg border px-2 py-2 text-sm" />
          </div>
          <button onClick={() => save(g)} disabled={savingId === g.id} className="mt-3 rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'var(--fd-maroon)' }}>
            {savingId === g.id ? 'Saving...' : 'Save'}
          </button>
        </div>
      ))}
    </div>
  )
}
