import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'
import { DIVISIONS, BRACKET_CODES, inferDivisionFromClassYear } from '@/lib/divisions'
import { TeamDivisionEditor } from '@/components/admin/team-division-editor'

export const dynamic = 'force-dynamic'

export default async function AdminDivisionsPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) {
    return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>
  }

  const teams = await db.team.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ division: 'asc' }, { displayName: 'asc' }],
  })

  return (
    <section className="space-y-5">
      <AdminNav />

      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · Divisions</h1>
        <p className="text-sm text-neutral-600">{tournament.name} {tournament.year}</p>
      </div>

      {/* Division config reference */}
      <div className="rounded-xl border bg-white p-5 space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--fd-ink)' }}>Division Configuration</h2>
        <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>
          Divisions are defined in <code className="font-mono bg-neutral-100 px-1 rounded text-xs">src/lib/divisions.ts</code>.
          To add a new division (e.g. Platinum), add an entry to the <code className="font-mono bg-neutral-100 px-1 rounded text-xs">DIVISIONS</code> array.
          No database migration required.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {DIVISIONS.sort((a, b) => a.sortOrder - b.sortOrder).map(div => (
            <div
              key={div.id}
              className="rounded-lg border p-3"
              style={{ borderColor: `${div.color}30`, background: div.colorMuted }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: div.color }} />
                <span className="font-semibold text-sm" style={{ color: div.color }}>{div.label}</span>
              </div>
              <p className="text-xs mb-1" style={{ color: 'var(--neutral-600)' }}>{div.description}</p>
              <p className="text-[10px] font-mono" style={{ color: 'var(--neutral-400)' }}>
                {div.classYearMin ? `≥ ${div.classYearMin}` : 'Any'} — {div.classYearMax ? `≤ ${div.classYearMax}` : 'Any'}
              </p>
            </div>
          ))}
        </div>

        {/* Bracket codes */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: 'var(--neutral-500)' }}>Bracket Codes</h3>
          <div className="flex flex-wrap gap-2">
            {BRACKET_CODES.map(b => {
              const div = DIVISIONS.find(d => d.id === b.divisionId)
              return (
                <span
                  key={b.code}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: div ? div.colorMuted : 'var(--neutral-100)',
                    color: div?.color ?? 'var(--neutral-600)',
                    border: `1px solid ${div ? `${div.color}25` : 'var(--border-subtle)'}`,
                  }}
                  title={b.label}
                >
                  <span className="font-bold">{b.code}</span>
                  <span className="text-[10px]">= {b.label}</span>
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Team division editor */}
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--fd-ink)' }}>
            Team Division Assignments ({teams.length} teams)
          </h2>
          <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            Auto-infer uses class year ranges from config
          </span>
        </div>
        <TeamDivisionEditor
          teams={teams.map(t => ({
            id: t.id,
            displayName: t.displayName,
            classYearLabel: t.classYearLabel,
            division: t.division,
            suggestedDivision: inferDivisionFromClassYear(t.classYearLabel)?.id ?? null,
          }))}
        />
      </div>
    </section>
  )
}
