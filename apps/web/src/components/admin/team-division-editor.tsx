'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DIVISIONS } from '@/lib/divisions'

type TeamItem = {
  id: string
  displayName: string
  classYearLabel: string
  division: string | null
  suggestedDivision: string | null
}

export function TeamDivisionEditor({ teams }: { teams: TeamItem[] }) {
  const [items, setItems] = useState(teams)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  const updateItem = (id: string, division: string | null) => {
    setItems(prev => prev.map(t => t.id === id ? { ...t, division } : t))
  }

  const saveTeam = async (team: TeamItem) => {
    setSaving(team.id)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ division: team.division }),
      })
      if (!res.ok) throw new Error('Save failed')
      setMsg(`Saved ${team.displayName}`)
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  const applyAllSuggestions = async () => {
    setSaving('all')
    setMsg(null)
    let saved = 0
    for (const team of items) {
      if (team.suggestedDivision && team.division !== team.suggestedDivision) {
        try {
          await fetch(`/api/admin/teams/${team.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ division: team.suggestedDivision }),
          })
          saved++
          setItems(prev => prev.map(t => t.id === team.id ? { ...t, division: team.suggestedDivision } : t))
        } catch { /* continue */ }
      }
    }
    setMsg(`Applied suggestions to ${saved} team${saved !== 1 ? 's' : ''}`)
    setSaving(null)
    router.refresh()
  }

  const selectCls = 'rounded-lg border px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[color:var(--fd-maroon)]'

  const hasPendingSuggestions = items.some(t => t.suggestedDivision && t.division !== t.suggestedDivision)

  return (
    <div className="space-y-3">
      {/* Bulk action */}
      {hasPendingSuggestions && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3"
          style={{ background: 'rgba(217,178,111,0.1)', border: '1px solid rgba(217,178,111,0.3)' }}
        >
          <p className="text-xs" style={{ color: 'var(--fd-gold-muted)' }}>
            Some teams have inferred division suggestions based on class year. Apply all?
          </p>
          <button
            onClick={applyAllSuggestions}
            disabled={saving === 'all'}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: 'var(--fd-gold)', color: 'var(--fd-maroon-deeper)' }}
          >
            {saving === 'all' ? 'Applying...' : 'Apply All Suggestions'}
          </button>
        </div>
      )}

      {msg && (
        <p className="text-xs px-1" style={{ color: msg.includes('failed') ? '#dc2626' : '#16a34a' }}>{msg}</p>
      )}

      {/* Team list */}
      <div className="divide-y rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
        {items.map(team => {
          const currentDiv = DIVISIONS.find(d => d.id === team.division)
          const suggestedDiv = DIVISIONS.find(d => d.id === team.suggestedDivision)
          const hasDiff = team.suggestedDivision && team.division !== team.suggestedDivision

          return (
            <div
              key={team.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
              style={{ background: hasDiff ? 'rgba(217,178,111,0.04)' : undefined }}
            >
              {/* Team info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm" style={{ color: 'var(--fd-ink)' }}>{team.displayName}</p>
                <p className="text-xs" style={{ color: 'var(--neutral-400)' }}>Class: {team.classYearLabel}</p>
                {hasDiff && suggestedDiv && (
                  <p className="text-[10px] mt-0.5" style={{ color: suggestedDiv.color }}>
                    Suggested: {suggestedDiv.label}
                  </p>
                )}
              </div>

              {/* Division selector */}
              <div className="flex items-center gap-2 sm:w-52">
                {currentDiv && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: currentDiv.color }} />
                )}
                <select
                  value={team.division ?? ''}
                  onChange={(e) => updateItem(team.id, e.target.value || null)}
                  className={selectCls}
                >
                  <option value="">— Unassigned —</option>
                  {DIVISIONS.sort((a, b) => a.sortOrder - b.sortOrder).map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Save button */}
              <button
                onClick={() => saveTeam(team)}
                disabled={saving === team.id || saving === 'all'}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 shrink-0"
                style={{ background: 'var(--fd-maroon)' }}
              >
                {saving === team.id ? 'Saving...' : 'Save'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
