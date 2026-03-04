'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DIVISIONS } from '@/lib/divisions'

function isValidUrl(value: string) {
  if (!value) return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

type GameLink = {
  id: string
  startTime: string
  division: string | null
  bracketCode: string | null
  ticketUrl: string | null
  streamUrl: string | null
  homeTeam: { displayName: string; division?: string | null }
  awayTeam: { displayName: string }
}

type Filters = {
  division: string
  phase: string  // 'pool' | 'playoff' | 'fatherson' | ''
  missingOnly: 'ticket' | 'stream' | 'both' | ''
}

type LocalEdit = {
  ticketUrl: string | null
  streamUrl: string | null
  dirty: boolean
}

export function BulkLinkEditor({ initialGames }: { initialGames: GameLink[] }) {
  const router = useRouter()
  const [games, setGames] = useState<GameLink[]>(initialGames)
  const [edits, setEdits] = useState<Record<string, LocalEdit>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [filters, setFilters] = useState<Filters>({ division: '', phase: '', missingOnly: '' })

  // Build bulk-fill state
  const [bulkTicket, setBulkTicket] = useState('')
  const [bulkStream, setBulkStream] = useState('')

  const currentVal = (g: GameLink, field: 'ticketUrl' | 'streamUrl') => {
    const e = edits[g.id]
    if (e && Object.prototype.hasOwnProperty.call(e, field)) return e[field] ?? ''
    return g[field] ?? ''
  }

  const updateEdit = (id: string, field: 'ticketUrl' | 'streamUrl', value: string) => {
    setEdits(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? { ticketUrl: null, streamUrl: null, dirty: false }), [field]: value || null, dirty: true },
    }))
  }

  const phaseof = (g: GameLink): 'fatherson' | 'playoff' | 'pool' => {
    if (g.bracketCode === 'FS' || /\bFS\b/i.test(g.homeTeam.displayName)) return 'fatherson'
    if (g.bracketCode) return 'playoff'
    return 'pool'
  }

  const filteredGames = useMemo(() => {
    return games.filter(g => {
      const effDiv = g.division ?? g.homeTeam.division ?? ''
      if (filters.division && effDiv !== filters.division) return false
      if (filters.phase && phaseof(g) !== filters.phase) return false
      if (filters.missingOnly === 'ticket' && (currentVal(g, 'ticketUrl') || g.ticketUrl)) return false
      if (filters.missingOnly === 'stream' && (currentVal(g, 'streamUrl') || g.streamUrl)) return false
      if (filters.missingOnly === 'both' && (currentVal(g, 'ticketUrl') || g.ticketUrl) && (currentVal(g, 'streamUrl') || g.streamUrl)) return false
      return true
    })
  }, [games, edits, filters])

  const dirtyGames = filteredGames.filter(g => edits[g.id]?.dirty)

  const applyBulkTicket = () => {
    if (!bulkTicket) return
    if (!isValidUrl(bulkTicket)) { setMsg({ text: 'Invalid ticket URL', ok: false }); return }
    const patch: Record<string, LocalEdit> = {}
    filteredGames.forEach(g => {
      patch[g.id] = { ...(edits[g.id] ?? { ticketUrl: null, streamUrl: null, dirty: false }), ticketUrl: bulkTicket, dirty: true }
    })
    setEdits(prev => ({ ...prev, ...patch }))
    setMsg({ text: `Applied ticket URL to ${filteredGames.length} visible games`, ok: true })
  }

  const applyBulkStream = () => {
    if (!bulkStream) return
    if (!isValidUrl(bulkStream)) { setMsg({ text: 'Invalid stream URL', ok: false }); return }
    const patch: Record<string, LocalEdit> = {}
    filteredGames.forEach(g => {
      patch[g.id] = { ...(edits[g.id] ?? { ticketUrl: null, streamUrl: null, dirty: false }), streamUrl: bulkStream, dirty: true }
    })
    setEdits(prev => ({ ...prev, ...patch }))
    setMsg({ text: `Applied stream URL to ${filteredGames.length} visible games`, ok: true })
  }

  const saveAll = async () => {
    const updates = Object.entries(edits)
      .filter(([, e]) => e.dirty)
      .map(([id, e]) => ({ id, ticketUrl: e.ticketUrl, streamUrl: e.streamUrl }))

    if (updates.length === 0) { setMsg({ text: 'No changes to save', ok: false }); return }

    for (const u of updates) {
      if ((u.ticketUrl && !isValidUrl(u.ticketUrl)) || (u.streamUrl && !isValidUrl(u.streamUrl))) {
        setMsg({ text: `Invalid URL detected for game ${u.id}`, ok: false })
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/games/bulk-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setMsg({ text: `Saved ${data.saved} games${data.failed > 0 ? `, ${data.failed} failed` : ''}`, ok: data.failed === 0 })
      // Clear dirty flags
      setEdits(prev => {
        const next = { ...prev }
        updates.forEach(u => { if (next[u.id]) next[u.id] = { ...next[u.id], dirty: false } })
        return next
      })
      router.refresh()
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'rounded-lg border px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[color:var(--fd-maroon)]'
  const activeDivisions = [...new Set(games.map(g => g.division ?? g.homeTeam.division ?? '').filter(Boolean))]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border bg-white p-4 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--neutral-500)' }}>Filter</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--neutral-500)' }}>Division</label>
            <select value={filters.division} onChange={e => setFilters(f => ({ ...f, division: e.target.value }))} className={inputCls}>
              <option value="">All divisions</option>
              {DIVISIONS.filter(d => activeDivisions.includes(d.id)).sort((a,b) => a.sortOrder - b.sortOrder).map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--neutral-500)' }}>Phase</label>
            <select value={filters.phase} onChange={e => setFilters(f => ({ ...f, phase: e.target.value }))} className={inputCls}>
              <option value="">All phases</option>
              <option value="pool">Pool</option>
              <option value="playoff">Playoffs</option>
              <option value="fatherson">Father-Son</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--neutral-500)' }}>Show only</label>
            <select value={filters.missingOnly} onChange={e => setFilters(f => ({ ...f, missingOnly: e.target.value as Filters['missingOnly'] }))} className={inputCls}>
              <option value="">All games</option>
              <option value="ticket">Missing ticket link</option>
              <option value="stream">Missing stream link</option>
              <option value="both">Missing either link</option>
            </select>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--neutral-400)' }}>{filteredGames.length} of {games.length} games visible</p>
      </div>

      {/* Bulk fill */}
      <div className="rounded-xl border bg-white p-4 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--neutral-500)' }}>Bulk Fill (applies to all visible games)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex gap-2">
            <input
              placeholder="Ticket URL for all visible"
              value={bulkTicket}
              onChange={e => setBulkTicket(e.target.value)}
              className={inputCls}
            />
            <button
              onClick={applyBulkTicket}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
              style={{ background: 'var(--fd-maroon)' }}
            >
              Apply
            </button>
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Stream URL for all visible"
              value={bulkStream}
              onChange={e => setBulkStream(e.target.value)}
              className={inputCls}
            />
            <button
              onClick={applyBulkStream}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
              style={{ background: 'var(--fd-maroon)' }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      {(msg || dirtyGames.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 bg-white" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            {dirtyGames.length > 0 && (
              <span className="text-sm font-medium" style={{ color: 'var(--fd-maroon)' }}>
                {dirtyGames.length} unsaved change{dirtyGames.length !== 1 ? 's' : ''}
              </span>
            )}
            {msg && (
              <span className="text-sm" style={{ color: msg.ok ? '#16a34a' : '#dc2626' }}>{msg.text}</span>
            )}
          </div>
          <button
            onClick={saveAll}
            disabled={saving || dirtyGames.length === 0}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:-translate-y-0.5"
            style={{ background: 'var(--fd-maroon)' }}
          >
            {saving ? 'Saving...' : `Save All Changes (${Object.values(edits).filter(e => e.dirty).length})`}
          </button>
        </div>
      )}

      {/* Game rows */}
      {filteredGames.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--neutral-400)' }}>
          No games match current filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGames.map(g => {
            const edit = edits[g.id]
            const ticketVal = (edit && Object.prototype.hasOwnProperty.call(edit, 'ticketUrl') ? edit.ticketUrl : g.ticketUrl) ?? ''
            const streamVal = (edit && Object.prototype.hasOwnProperty.call(edit, 'streamUrl') ? edit.streamUrl : g.streamUrl) ?? ''
            const isDirty = edit?.dirty ?? false

            return (
              <div
                key={g.id}
                className="rounded-xl border bg-white p-3 transition-all"
                style={{
                  borderColor: isDirty ? 'var(--fd-maroon)' : 'var(--border-subtle)',
                  borderWidth: isDirty ? '1.5px' : '1px',
                }}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                  <p className="font-medium text-sm" style={{ color: 'var(--fd-ink)' }}>
                    {g.awayTeam.displayName} <span style={{ color: 'var(--neutral-400)' }}>vs</span> {g.homeTeam.displayName}
                  </p>
                  <span className="text-xs" style={{ color: 'var(--neutral-400)' }}>
                    {new Date(g.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                  {g.division && (
                    <span className="text-xs font-semibold" style={{ color: 'var(--fd-maroon)' }}>{g.division}</span>
                  )}
                  {g.bracketCode && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: '#f0f0f0', color: '#555' }}>{g.bracketCode}</span>
                  )}
                  {isDirty && <span className="text-[10px] font-semibold" style={{ color: 'var(--fd-maroon)' }}>● edited</span>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    placeholder="Ticket URL"
                    value={ticketVal}
                    onChange={e => updateEdit(g.id, 'ticketUrl', e.target.value)}
                    className={inputCls}
                  />
                  <input
                    placeholder="Stream URL"
                    value={streamVal}
                    onChange={e => updateEdit(g.id, 'streamUrl', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
