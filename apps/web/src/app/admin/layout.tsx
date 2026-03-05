import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { TournamentProvider, type TournamentSummary } from '@/contexts/tournament-context'
import { AdminHeader } from '@/components/admin/admin-header'
import { findActiveTournament } from '@/lib/tournament-utils'

async function getInitialTournaments(): Promise<TournamentSummary[]> {
  return db.tournament.findMany({
    take: 100,
    select: {
      id: true,
      name: true,
      year: true,
      status: true,
    },
    orderBy: [{ year: 'desc' }, { name: 'asc' }],
  })
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournaments = await getInitialTournaments()

  const activeTournament = findActiveTournament(tournaments)

  return (
    <TournamentProvider
      initialTournaments={tournaments}
      initialCurrentId={activeTournament?.id ?? null}
    >
      <div className="space-y-4">
        <AdminHeader userEmail={user.email} userRole={user.role} />
        {children}
      </div>
    </TournamentProvider>
  )
}
