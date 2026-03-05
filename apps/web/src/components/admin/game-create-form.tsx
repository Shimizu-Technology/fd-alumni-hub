'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DIVISIONS, BRACKET_CODES } from '@/lib/divisions'
import { Gamepad2 } from 'lucide-react'
import {
  AdminInput,
  AdminSelect,
  AdminButton,
  AdminCard,
  AdminCardTitle,
  AdminMessage,
} from './ui'

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
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const router = useRouter()

  const valid = useMemo(
    () => homeTeamId && awayTeamId && homeTeamId !== awayTeamId && startTime,
    [homeTeamId, awayTeamId, startTime]
  )

  // When home team changes, auto-suggest division from team
  const handleHomeTeamChange = (id: string) => {
    setHomeTeamId(id)
    if (!division) {
      const team = teams.find((t) => t.id === id)
      if (team?.division) setDivision(team.division)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if (!valid) {
      setMsg({ text: 'Please select different home/away teams and a start time', ok: false })
      return
    }

    setLoading(true)
    try {
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
        setMsg({ text: data?.error || 'Failed to create game', ok: false })
        return
      }

      setMsg({ text: 'Game created successfully', ok: true })
      router.refresh()

      // Reset form
      setHomeTeamId('')
      setAwayTeamId('')
      setStartTime('')
      setDivision('')
      setBracketCode('')
    } catch {
      setMsg({ text: 'Something went wrong', ok: false })
    } finally {
      setLoading(false)
    }
  }

  // Group teams by division for better selection UX
  const teamsByDivision = useMemo(() => {
    const grouped: Record<string, TeamOption[]> = {}
    teams.forEach((t) => {
      const div = t.division || 'Unassigned'
      if (!grouped[div]) grouped[div] = []
      grouped[div].push(t)
    })
    return grouped
  }, [teams])

  const sortedDivisions = Object.keys(teamsByDivision).sort((a, b) => {
    const aOrder = DIVISIONS.find((d) => d.id === a)?.sortOrder ?? 999
    const bOrder = DIVISIONS.find((d) => d.id === b)?.sortOrder ?? 999
    return aOrder - bOrder
  })

  return (
    <AdminCard>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'var(--fd-maroon)/10' }}
          >
            <Gamepad2 className="h-5 w-5 text-[var(--fd-maroon)]" />
          </div>
          <AdminCardTitle className="mb-0">Add New Game</AdminCardTitle>
        </div>

        {/* Teams */}
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminSelect
            label="Away Team"
            value={awayTeamId}
            onChange={(e) => setAwayTeamId(e.target.value)}
            required
          >
            <option value="">Select away team</option>
            {sortedDivisions.map((div) => (
              <optgroup key={div} label={div}>
                {teamsByDivision[div].map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </AdminSelect>
          <AdminSelect
            label="Home Team"
            value={homeTeamId}
            onChange={(e) => handleHomeTeamChange(e.target.value)}
            required
          >
            <option value="">Select home team</option>
            {sortedDivisions.map((div) => (
              <optgroup key={div} label={div}>
                {teamsByDivision[div].map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </AdminSelect>
        </div>

        {/* Time + Venue */}
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminInput
            label="Start Time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <AdminInput
            label="Venue"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="FD Jungle"
          />
        </div>

        {/* Division + Bracket Code */}
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminSelect
            label="Division"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="">— Auto (from team) —</option>
            {DIVISIONS.sort((a, b) => a.sortOrder - b.sortOrder).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect
            label="Bracket Code"
            value={bracketCode}
            onChange={(e) => setBracketCode(e.target.value)}
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
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
          <AdminButton type="submit" loading={loading} disabled={!valid}>
            Create Game
          </AdminButton>
          {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
        </div>
      </form>
    </AdminCard>
  )
}
