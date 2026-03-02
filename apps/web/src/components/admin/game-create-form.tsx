'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type TeamOption = { id: string; displayName: string }

export function GameCreateForm({
  tournamentId,
  teams,
}: {
  tournamentId: string
  teams: TeamOption[]
}) {
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [venue, setVenue] = useState('FD Jungle')
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const valid = useMemo(
    () => homeTeamId && awayTeamId && homeTeamId !== awayTeamId && startTime,
    [homeTeamId, awayTeamId, startTime]
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!valid) {
      setMsg('Please set different home/away teams and a start time')
      return
    }

    const res = await fetch('/api/admin/games/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, homeTeamId, awayTeamId, startTime, venue }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg(data?.error || 'Failed to create game')
      return
    }

    setMsg('Created successfully')
    router.refresh()
    setHomeTeamId('')
    setAwayTeamId('')
    setStartTime('')
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold">Add Game</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} className="rounded-lg border px-2 py-2 text-sm" required>
          <option value="">Away team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.displayName}</option>
          ))}
        </select>
        <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} className="rounded-lg border px-2 py-2 text-sm" required>
          <option value="">Home team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.displayName}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-lg border px-2 py-2 text-sm" required />
        <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" className="rounded-lg border px-2 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'var(--fd-maroon)' }}>Create Game</button>
        {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      </div>
    </form>
  )
}
