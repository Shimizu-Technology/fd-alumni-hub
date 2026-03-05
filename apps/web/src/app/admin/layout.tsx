import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { TournamentProvider, type TournamentSummary } from '@/contexts/tournament-context'
import { AdminHeader } from '@/components/admin/admin-header'

async function getInitialTournaments(): Promise<TournamentSummary[]> {
  const tournaments = await db.tournament.findMany({
    select: {
      id: true,
      name: true,
      year: true,
      status: true,
      startDate: true,
      endDate: true,
    },
    orderBy: [{ year: 'desc' }, { name: 'asc' }],
  })

  return tournaments.map((t) => ({
    ...t,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
  }))
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournaments = await getInitialTournaments()

  // Find the active tournament ID (live > upcoming > most recent completed)
  const activeTournament =
    tournaments.find((t) => t.status === 'live') ??
    tournaments.find((t) => t.status === 'upcoming') ??
    tournaments[0]

  return (
    <TournamentProvider
      initialTournaments={tournaments}
      initialCurrentId={activeTournament?.id}
    >
      <div className="space-y-4">
        <AdminHeader userEmail={user.email} userRole={user.role} />
        {children}
      </div>
    </TournamentProvider>
  )
}
