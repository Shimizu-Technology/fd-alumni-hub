'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DIVISIONS, BRACKET_CODES } from '@/lib/divisions'

type TeamOption = { id: string; displayName: string; division?: string | null }

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
  const [division, setDivision] = useState('')
  const [bracketCode, setBracketCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const valid = useMemo(
    () => homeTeamId && awayTeamId && homeTeamId !== awayTeamId && startTime,
    [homeTeamId, awayTeamId, startTime]
  )

  // When home team changes, auto-suggest division from team
  const handleHomeTeamChange = (id: string) => {
    setHomeTeamId(id)
    if (!division) {
      const team = teams.find(t => t.id === id)
      if (team?.division) setDivision(team.division)
    }
  }

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
      body: JSON.stringify({
        tournamentId,
        homeTeamId,
        awayTeamId,
        startTime,
        venue,
        division: division || null,
        bracketCode: bracketCode || null,
      }),
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
    setDivision('')
    setBracketCode('')
  }

  const inputCls = 'rounded-lg border px-2 py-2 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[color:var(--fd-maroon)]'

  return (
    <form onSubmit={submit} className="rounded-xl border bg-white p-4 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--fd-ink)' }}>Add Game</h2>

      {/* Teams */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Away Team</label>
          <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} className={inputCls} required>
            <option value="">Select away team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.displayName}{t.division ? ` (${t.division})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Home Team</label>
          <select value={homeTeamId} onChange={(e) => handleHomeTeamChange(e.target.value)} className={inputCls} required>
            <option value="">Select home team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.displayName}{t.division ? ` (${t.division})` : ''}</option>)}
          </select>
        </div>
      </div>

      {/* Time + Venue */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Start Time</label>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Venue</label>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" className={inputCls} />
        </div>
      </div>

      {/* Division + Bracket Code */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Division</label>
          <select value={division} onChange={(e) => setDivision(e.target.value)} className={inputCls}>
            <option value="">— Auto / None —</option>
            {DIVISIONS.sort((a, b) => a.sortOrder - b.sortOrder).map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Bracket Code</label>
          <select value={bracketCode} onChange={(e) => setBracketCode(e.target.value)} className={inputCls}>
            <option value="">— Regular Season —</option>
            {BRACKET_CODES.map(b => (
              <option key={b.code} value={b.code}>{b.code} — {b.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
          style={{ background: 'var(--fd-maroon)' }}
          disabled={!valid}
        >
          Create Game
        </button>
        {msg && <p className="text-xs" style={{ color: msg.includes('success') ? '#16a34a' : '#dc2626' }}>{msg}</p>}
      </div>
    </form>
  )
}
