'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DIVISIONS } from '@/lib/divisions'
import { Filter, Zap, Save, Edit3, Calendar } from 'lucide-react'
import {
  AdminInput,
  AdminSelect,
  AdminButton,
  AdminCard,
  AdminCardTitle,
  AdminMessage,
  AdminEmptyState,
  AdminBadge,
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
  phase: string
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

  // Bulk-fill state
  const [bulkTicket, setBulkTicket] = useState('')
  const [bulkStream, setBulkStream] = useState('')

  const currentVal = (g: GameLink, field: 'ticketUrl' | 'streamUrl') => {
    const e = edits[g.id]
    if (e && Object.prototype.hasOwnProperty.call(e, field)) return e[field] ?? ''
    return g[field] ?? ''
  }

  const updateEdit = (id: string, field: 'ticketUrl' | 'streamUrl', value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { ticketUrl: null, streamUrl: null, dirty: false }),
        [field]: value || null,
        dirty: true,
      },
    }))
  }

  const phaseof = (g: GameLink): 'fatherson' | 'playoff' | 'pool' => {
    if (g.bracketCode === 'FS' || /\bFS\b/i.test(g.homeTeam.displayName)) return 'fatherson'
    if (g.bracketCode) return 'playoff'
    return 'pool'
  }

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      const effDiv = g.division ?? g.homeTeam.division ?? ''
      if (filters.division && effDiv !== filters.division) return false
      if (filters.phase && phaseof(g) !== filters.phase) return false
      if (filters.missingOnly === 'ticket' && (currentVal(g, 'ticketUrl') || g.ticketUrl))
        return false
      if (filters.missingOnly === 'stream' && (currentVal(g, 'streamUrl') || g.streamUrl))
        return false
      if (
        filters.missingOnly === 'both' &&
        (currentVal(g, 'ticketUrl') || g.ticketUrl) &&
        (currentVal(g, 'streamUrl') || g.streamUrl)
      )
        return false
      return true
    })
  }, [games, edits, filters])

  const dirtyGames = Object.entries(edits).filter(([, e]) => e.dirty)

  const applyBulkTicket = () => {
    if (!bulkTicket) return
    if (!isValidUrl(bulkTicket)) {
      setMsg({ text: 'Invalid ticket URL format', ok: false })
      return
    }
    const patch: Record<string, LocalEdit> = {}
    filteredGames.forEach((g) => {
      patch[g.id] = {
        ...(edits[g.id] ?? { ticketUrl: null, streamUrl: null, dirty: false }),
        ticketUrl: bulkTicket,
        dirty: true,
      }
    })
    setEdits((prev) => ({ ...prev, ...patch }))
    setMsg({ text: `Applied ticket URL to ${filteredGames.length} visible games`, ok: true })
  }

  const applyBulkStream = () => {
    if (!bulkStream) return
    if (!isValidUrl(bulkStream)) {
      setMsg({ text: 'Invalid stream URL format', ok: false })
      return
    }
    const patch: Record<string, LocalEdit> = {}
    filteredGames.forEach((g) => {
      patch[g.id] = {
        ...(edits[g.id] ?? { ticketUrl: null, streamUrl: null, dirty: false }),
        streamUrl: bulkStream,
        dirty: true,
      }
    })
    setEdits((prev) => ({ ...prev, ...patch }))
    setMsg({ text: `Applied stream URL to ${filteredGames.length} visible games`, ok: true })
  }

  const saveAll = async () => {
    const updates = dirtyGames.map(([id, e]) => ({
      id,
      ticketUrl: e.ticketUrl,
      streamUrl: e.streamUrl,
    }))

    if (updates.length === 0) {
      setMsg({ text: 'No changes to save', ok: false })
      return
    }

    for (const u of updates) {
      if ((u.ticketUrl && !isValidUrl(u.ticketUrl)) || (u.streamUrl && !isValidUrl(u.streamUrl))) {
        setMsg({ text: `Invalid URL detected for game ${u.id.slice(0, 8)}…`, ok: false })
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
      setMsg({
        text: `Saved ${data.saved} games${data.failed > 0 ? `, ${data.failed} failed` : ''}`,
        ok: data.failed === 0,
      })
      // Clear dirty flags
      setEdits((prev) => {
        const next = { ...prev }
        updates.forEach((u) => {
          if (next[u.id]) next[u.id] = { ...next[u.id], dirty: false }
        })
        return next
      })
      router.refresh()
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const activeDivisions = [...new Set(games.map((g) => g.division ?? g.homeTeam.division ?? '').filter(Boolean))]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <AdminCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--neutral-100)]">
            <Filter className="h-4 w-4 text-[var(--neutral-500)]" />
          </div>
          <AdminCardTitle className="mb-0">Filter Games</AdminCardTitle>
          <span className="ml-auto text-xs text-[var(--neutral-400)]">
            {filteredGames.length} of {games.length} games visible
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminSelect
            label="Division"
            value={filters.division}
            onChange={(e) => setFilters((f) => ({ ...f, division: e.target.value }))}
          >
            <option value="">All divisions</option>
            {DIVISIONS.filter((d) => activeDivisions.includes(d.id))
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
          </AdminSelect>
          <AdminSelect
            label="Phase"
            value={filters.phase}
            onChange={(e) => setFilters((f) => ({ ...f, phase: e.target.value }))}
          >
            <option value="">All phases</option>
            <option value="pool">Pool Play</option>
            <option value="playoff">Playoffs</option>
            <option value="fatherson">Father-Son</option>
          </AdminSelect>
          <AdminSelect
            label="Show Only"
            value={filters.missingOnly}
            onChange={(e) =>
              setFilters((f) => ({ ...f, missingOnly: e.target.value as Filters['missingOnly'] }))
            }
          >
            <option value="">All games</option>
            <option value="ticket">Missing ticket link</option>
            <option value="stream">Missing stream link</option>
            <option value="both">Missing either link</option>
          </AdminSelect>
        </div>
      </AdminCard>

      {/* Bulk fill */}
      <AdminCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <Zap className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <AdminCardTitle className="mb-0">Bulk Fill</AdminCardTitle>
            <p className="text-xs text-[var(--neutral-400)]">
              Applies to all {filteredGames.length} visible games
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-2">
            <AdminInput
              placeholder="Ticket URL for all visible"
              value={bulkTicket}
              onChange={(e) => setBulkTicket(e.target.value)}
            />
            <AdminButton onClick={applyBulkTicket} variant="secondary" className="shrink-0">
              Apply
            </AdminButton>
          </div>
          <div className="flex gap-2">
            <AdminInput
              placeholder="Stream URL for all visible"
              value={bulkStream}
              onChange={(e) => setBulkStream(e.target.value)}
            />
            <AdminButton onClick={applyBulkStream} variant="secondary" className="shrink-0">
              Apply
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      {/* Status bar */}
      {(msg || dirtyGames.length > 0) && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 bg-white shadow-sm transition-all"
          style={{
            borderColor: dirtyGames.length > 0 ? 'var(--fd-maroon)' : 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-3">
            {dirtyGames.length > 0 && (
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--fd-maroon)]">
                <Edit3 className="h-4 w-4" />
                {dirtyGames.length} unsaved change{dirtyGames.length !== 1 ? 's' : ''}
              </span>
            )}
            {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
          </div>
          <AdminButton
            onClick={saveAll}
            loading={saving}
            disabled={dirtyGames.length === 0}
          >
            <Save className="h-4 w-4" />
            Save All Changes ({dirtyGames.length})
          </AdminButton>
        </div>
      )}

      {/* Game rows */}
      {filteredGames.length === 0 ? (
        <AdminEmptyState
          icon={Filter}
          title="No games match current filters"
          description="Try adjusting your filters or add more games."
        />
      ) : (
        <div className="space-y-2">
          {filteredGames.map((g, index) => {
            const edit = edits[g.id]
            const ticketVal =
              edit && Object.prototype.hasOwnProperty.call(edit, 'ticketUrl')
                ? (edit.ticketUrl ?? '')
                : (g.ticketUrl ?? '')
            const streamVal =
              edit && Object.prototype.hasOwnProperty.call(edit, 'streamUrl')
                ? (edit.streamUrl ?? '')
                : (g.streamUrl ?? '')
            const isDirty = edit?.dirty ?? false

            return (
              <div
                key={g.id}
                className="rounded-xl border bg-white p-4 transition-all duration-200 animate-fade-up hover:shadow-sm"
                style={{
                  borderColor: isDirty ? 'var(--fd-maroon)' : 'var(--border-subtle)',
                  borderWidth: isDirty ? '2px' : '1px',
                  animationDelay: `${index * 20}ms`,
                }}
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm font-medium text-[var(--fd-ink)]">
                    {g.awayTeam.displayName}{' '}
                    <span className="text-[var(--neutral-400)]">vs</span>{' '}
                    {g.homeTeam.displayName}
                  </p>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--neutral-400)]">
                    <Calendar className="h-3 w-3" />
                    {new Date(g.startTime).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  {g.division && (
                    <AdminBadge variant="default">{g.division}</AdminBadge>
                  )}
                  {g.bracketCode && (
                    <AdminBadge variant="default">{g.bracketCode}</AdminBadge>
                  )}
                  {isDirty && (
                    <AdminBadge variant="warning">
                      <Edit3 className="mr-1 h-2.5 w-2.5" />
                      Edited
                    </AdminBadge>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminInput
                    placeholder="Ticket URL"
                    value={ticketVal}
                    onChange={(e) => updateEdit(g.id, 'ticketUrl', e.target.value)}
                  />
                  <AdminInput
                    placeholder="Stream URL"
                    value={streamVal}
                    onChange={(e) => updateEdit(g.id, 'streamUrl', e.target.value)}
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
