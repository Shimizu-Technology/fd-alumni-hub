'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DIVISIONS, BRACKET_CODES } from '@/lib/divisions'
import { Calendar, Trash2, Save } from 'lucide-react'
import {
  AdminInput,
  AdminSelect,
  AdminButton,
  AdminBadge,
  AdminMessage,
  AdminEmptyState,
  inputBaseClasses,
} from './ui'

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
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const router = useRouter()

  const updateGame = (id: string, patch: Partial<GameRow>) => {
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }

  const save = async (game: GameRow) => {
    setSavingId(game.id)
    setMsg(null)

    if (!isValidUrl(game.streamUrl ?? '') || !isValidUrl(game.ticketUrl ?? '')) {
      setMsg({ id: game.id, text: 'Invalid stream/ticket URL format', ok: false })
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
      setMsg({ id: game.id, text: 'Saved successfully', ok: true })
      router.refresh()
    } catch (e) {
      setMsg({ id: game.id, text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally {
      setSavingId(null)
    }
  }

  const archive = async (game: GameRow) => {
    if (!confirm('Archive/delete this game? This cannot be undone.')) return
    setSavingId(game.id)
    try {
      const res = await fetch(`/api/admin/games/${game.id}/archive`, { method: 'POST' })
      if (!res.ok) throw new Error('Archive failed')
      setMsg({ id: game.id, text: 'Archived', ok: true })
      router.refresh()
    } catch (e) {
      setMsg({ id: game.id, text: e instanceof Error ? e.message : 'Archive failed', ok: false })
    } finally {
      setSavingId(null)
    }
  }

  if (games.length === 0) {
    return (
      <AdminEmptyState
        title="No games scheduled"
        description="Create your first game using the form above."
      />
    )
  }

  return (
    <div className="space-y-3">
      {games.map((g, index) => {
        const effectiveDivision = g.division ?? g.homeTeam.division ?? null
        const divInfo = DIVISIONS.find((d) => d.id === effectiveDivision)
        const gameMsg = msg?.id === g.id ? msg : null

        return (
          <div
            key={g.id}
            className="rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 animate-fade-up hover:shadow-md"
            style={{
              borderColor: 'var(--border-subtle)',
              borderLeft: divInfo ? `4px solid ${divInfo.color}` : '4px solid var(--border-subtle)',
              animationDelay: `${index * 30}ms`,
            }}
          >
            {/* Header */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[var(--fd-ink)]">
                {g.awayTeam.displayName}{' '}
                <span className="font-normal text-[var(--neutral-400)]">vs</span>{' '}
                {g.homeTeam.displayName}
              </p>

              {/* Status badge */}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  g.status === 'live'
                    ? 'badge-live'
                    : g.status === 'final'
                    ? 'badge-final'
                    : 'badge-upcoming'
                }`}
              >
                {g.status === 'live' && <span className="live-dot mr-1.5" />}
                {g.status}
              </span>

              {effectiveDivision && (
                <AdminBadge
                  className="border"
                  style={{
                    background: divInfo?.colorMuted ?? 'var(--neutral-100)',
                    color: divInfo?.color ?? 'var(--neutral-600)',
                    borderColor: divInfo?.color ?? 'var(--border-subtle)',
                  }}
                >
                  {effectiveDivision}
                </AdminBadge>
              )}

              {g.bracketCode && (
                <AdminBadge variant="default">{g.bracketCode}</AdminBadge>
              )}

              <span className="ml-auto flex items-center gap-1.5 text-xs text-[var(--neutral-400)]">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(g.startTime).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {/* Row 1: Status + Scores */}
            <div className="mb-3 grid gap-3 sm:grid-cols-5">
              <AdminSelect
                label="Status"
                value={g.status}
                onChange={(e) => updateGame(g.id, { status: e.target.value as GameRow['status'] })}
              >
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="final">Final</option>
              </AdminSelect>
              <AdminInput
                label="Away Score"
                type="number"
                placeholder="—"
                min={0}
                value={g.awayScore ?? ''}
                onChange={(e) =>
                  updateGame(g.id, {
                    awayScore: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
              <AdminInput
                label="Home Score"
                type="number"
                placeholder="—"
                min={0}
                value={g.homeScore ?? ''}
                onChange={(e) =>
                  updateGame(g.id, {
                    homeScore: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
              <AdminInput
                label="Stream URL"
                type="url"
                placeholder="https://..."
                value={g.streamUrl ?? ''}
                onChange={(e) => updateGame(g.id, { streamUrl: e.target.value || null })}
              />
              <AdminInput
                label="Ticket URL"
                type="url"
                placeholder="https://..."
                value={g.ticketUrl ?? ''}
                onChange={(e) => updateGame(g.id, { ticketUrl: e.target.value || null })}
              />
            </div>

            {/* Row 2: Division + Bracket Code */}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <AdminSelect
                label="Division"
                value={g.division ?? ''}
                onChange={(e) => updateGame(g.id, { division: e.target.value || null })}
              >
                <option value="">— Auto / None —</option>
                {DIVISIONS.sort((a, b) => a.sortOrder - b.sortOrder).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect
                label="Bracket Code"
                value={g.bracketCode ?? ''}
                onChange={(e) => updateGame(g.id, { bracketCode: e.target.value || null })}
              >
                <option value="">— Pool Play —</option>
                {BRACKET_CODES.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} — {b.label}
                  </option>
                ))}
              </AdminSelect>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-3">
              <AdminButton
                onClick={() => save(g)}
                loading={savingId === g.id}
                size="sm"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </AdminButton>
              <AdminButton
                onClick={() => archive(g)}
                disabled={savingId === g.id}
                variant="danger"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
                Archive
              </AdminButton>
              {gameMsg && (
                <AdminMessage type={gameMsg.ok ? 'success' : 'error'}>
                  {gameMsg.text}
                </AdminMessage>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
