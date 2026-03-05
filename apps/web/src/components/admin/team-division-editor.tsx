'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DIVISIONS } from '@/lib/divisions'
import { Users, Sparkles, Save } from 'lucide-react'
import {
  AdminSelect,
  AdminButton,
  AdminMessage,
  AdminBadge,
  AdminEmptyState,
} from './ui'

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
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const router = useRouter()

  const updateItem = (id: string, division: string | null) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, division } : t)))
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
      setMsg({ id: team.id, text: `Saved ${team.displayName}`, ok: true })
      router.refresh()
    } catch (e) {
      setMsg({ id: team.id, text: e instanceof Error ? e.message : 'Save failed', ok: false })
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
          setItems((prev) =>
            prev.map((t) =>
              t.id === team.id ? { ...t, division: team.suggestedDivision } : t
            )
          )
        } catch {
          /* continue */
        }
      }
    }
    setMsg({
      id: 'bulk',
      text: `Applied suggestions to ${saved} team${saved !== 1 ? 's' : ''}`,
      ok: true,
    })
    setSaving(null)
    router.refresh()
  }

  const hasPendingSuggestions = items.some(
    (t) => t.suggestedDivision && t.division !== t.suggestedDivision
  )

  if (items.length === 0) {
    return (
      <AdminEmptyState
        icon={Users}
        title="No teams found"
        description="Teams will appear here once they're imported."
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk action banner */}
      {hasPendingSuggestions && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-sm"
          style={{
            background: 'var(--fd-gold-light)',
            borderColor: 'var(--fd-gold)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/50">
              <Sparkles className="h-4 w-4" style={{ color: 'var(--fd-gold-muted)' }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--fd-maroon-deeper)' }}>
                Auto-assignment suggestions available
              </p>
              <p className="text-xs" style={{ color: 'var(--fd-maroon)' }}>
                Based on team class years, we can suggest divisions.
              </p>
            </div>
          </div>
          <AdminButton
            onClick={applyAllSuggestions}
            loading={saving === 'all'}
            variant="secondary"
          >
            <Sparkles className="h-4 w-4" />
            Apply All Suggestions
          </AdminButton>
        </div>
      )}

      {/* Global message */}
      {msg?.id === 'bulk' && (
        <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>
      )}

      {/* Team list */}
      <div
        className="divide-y overflow-hidden rounded-xl border shadow-sm"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {items.map((team, index) => {
          const currentDiv = DIVISIONS.find((d) => d.id === team.division)
          const suggestedDiv = DIVISIONS.find((d) => d.id === team.suggestedDivision)
          const hasDiff = team.suggestedDivision && team.division !== team.suggestedDivision
          const teamMsg = msg?.id === team.id ? msg : null

          return (
            <div
              key={team.id}
              className="flex flex-col gap-3 bg-white px-4 py-3 transition-all duration-200 animate-fade-up sm:flex-row sm:items-center sm:gap-4"
              style={{
                background: hasDiff ? 'rgba(217,178,111,0.06)' : undefined,
                animationDelay: `${index * 20}ms`,
              }}
            >
              {/* Team info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--fd-ink)]">
                    {team.displayName}
                  </p>
                  {currentDiv && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: currentDiv.color }}
                    />
                  )}
                </div>
                <p className="text-xs text-[var(--neutral-400)]">
                  Class: {team.classYearLabel}
                </p>
                {hasDiff && suggestedDiv && (
                  <AdminBadge
                    className="mt-1"
                    style={{
                      background: suggestedDiv.colorMuted,
                      color: suggestedDiv.color,
                    }}
                  >
                    <Sparkles className="mr-1 h-2.5 w-2.5" />
                    Suggested: {suggestedDiv.label}
                  </AdminBadge>
                )}
              </div>

              {/* Division selector */}
              <div className="sm:w-48">
                <AdminSelect
                  value={team.division ?? ''}
                  onChange={(e) => updateItem(team.id, e.target.value || null)}
                >
                  <option value="">— Unassigned —</option>
                  {DIVISIONS.sort((a, b) => a.sortOrder - b.sortOrder).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </AdminSelect>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <AdminButton
                  onClick={() => saveTeam(team)}
                  loading={saving === team.id}
                  disabled={saving === 'all'}
                  size="sm"
                >
                  <Save className="h-4 w-4" />
                  Save
                </AdminButton>
                {teamMsg && (
                  <AdminMessage type={teamMsg.ok ? 'success' : 'error'}>
                    {teamMsg.text}
                  </AdminMessage>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
