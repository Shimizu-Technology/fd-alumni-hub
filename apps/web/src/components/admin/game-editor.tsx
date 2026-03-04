'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DIVISIONS, BRACKET_CODES } from '@/lib/divisions'

function isValidUrl(value: string) {
  if (!value) return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

type GameRow = {
  id: string
  startTime: string
  status: 'scheduled' | 'live' | 'final'
  homeScore: number | null
  awayScore: number | null
  streamUrl: string | null
  ticketUrl: string | null
  division: string | null
  bracketCode: string | null
  homeTeam: { displayName: string; division?: string | null }
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
    if (!isValidUrl(game.streamUrl ?? '') || !isValidUrl(game.ticketUrl ?? '')) {
      setMsg('Please provide valid stream/ticket URL(s)')
      setSavingId(null)
      return
    }

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
          division: game.division || null,
          bracketCode: game.bracketCode || null,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setMsg(`Saved — ${game.awayTeam.displayName} vs ${game.homeTeam.displayName}`)
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  const archive = async (game: GameRow) => {
    if (!confirm('Archive/delete this game?')) return
    setSavingId(game.id)
    try {
      const res = await fetch(`/api/admin/games/${game.id}/archive`, { method: 'POST' })
      if (!res.ok) throw new Error('Archive failed')
      setMsg('Archived')
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Archive failed')
    } finally {
      setSavingId(null)
    }
  }

  const inputCls = 'rounded-lg border px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[color:var(--fd-maroon)]'

  return (
    <div className="space-y-3">
      {msg && (
        <p className="text-xs px-1" style={{ color: msg.includes('Saved') ? '#16a34a' : '#dc2626' }}>{msg}</p>
      )}
      {games.map((g) => {
        const effectiveDivision = g.division ?? g.homeTeam.division ?? null
        const divInfo = DIVISIONS.find(d => d.id === effectiveDivision)
        return (
          <div
            key={g.id}
            className="rounded-xl border bg-white p-4"
            style={{
              borderColor: 'var(--border-subtle)',
              borderLeft: divInfo ? `3px solid ${divInfo.color}` : undefined,
            }}
          >
            {/* Matchup header */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="font-medium text-sm" style={{ color: 'var(--fd-ink)' }}>
                {g.awayTeam.displayName} <span style={{ color: 'var(--neutral-400)' }}>vs</span> {g.homeTeam.displayName}
              </p>
              {effectiveDivision && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: divInfo?.colorMuted ?? '#f0f0f0', color: divInfo?.color ?? '#666' }}
                >
                  {effectiveDivision}
                </span>
              )}
              {g.bracketCode && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: '#f0f0f0', color: '#555' }}>
                  {g.bracketCode}
                </span>
              )}
            </div>
            <p className="mb-3 text-xs" style={{ color: 'var(--neutral-400)' }}>
              {new Date(g.startTime).toLocaleString('en-US')}
            </p>

            {/* Row 1: Status + Scores + URLs */}
            <div className="grid gap-2 sm:grid-cols-5 mb-2">
              <select
                value={g.status}
                onChange={(e) => updateGame(g.id, { status: e.target.value as GameRow['status'] })}
                className={inputCls}
              >
                <option value="scheduled">scheduled</option>
                <option value="live">live</option>
                <option value="final">final</option>
              </select>
              <input
                type="number"
                placeholder="Away score"
                value={g.awayScore ?? ''}
                onChange={(e) => updateGame(g.id, { awayScore: e.target.value === '' ? null : Number(e.target.value) })}
                className={inputCls}
              />
              <input
                type="number"
                placeholder="Home score"
                value={g.homeScore ?? ''}
                onChange={(e) => updateGame(g.id, { homeScore: e.target.value === '' ? null : Number(e.target.value) })}
                className={inputCls}
              />
              <input
                placeholder="Stream URL"
                value={g.streamUrl ?? ''}
                onChange={(e) => updateGame(g.id, { streamUrl: e.target.value || null })}
                className={inputCls}
              />
              <input
                placeholder="Ticket URL"
                value={g.ticketUrl ?? ''}
                onChange={(e) => updateGame(g.id, { ticketUrl: e.target.value || null })}
                className={inputCls}
              />
            </div>

            {/* Row 2: Division + Bracket Code */}
            <div className="grid gap-2 sm:grid-cols-2 mb-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--neutral-500)' }}>
                  Division
                </label>
                <select
                  value={g.division ?? ''}
                  onChange={(e) => updateGame(g.id, { division: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">— Auto / None —</option>
                  {DIVISIONS.sort((a, b) => a.sortOrder - b.sortOrder).map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--neutral-500)' }}>
                  Bracket Code
                </label>
                <select
                  value={g.bracketCode ?? ''}
                  onChange={(e) => updateGame(g.id, { bracketCode: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">— Regular Season —</option>
                  {BRACKET_CODES.map(b => (
                    <option key={b.code} value={b.code}>{b.code} — {b.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => save(g)}
                disabled={savingId === g.id}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: 'var(--fd-maroon)' }}
              >
                {savingId === g.id ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => archive(g)}
                disabled={savingId === g.id}
                className="rounded-lg border px-3 py-1.5 text-sm text-red-600 transition-all hover:bg-red-50 disabled:opacity-50"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                Archive
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
