import { db } from '@/lib/db'

export async function getActiveTournament() {
  return db.tournament.findFirst({
    where: { status: { in: ['live', 'upcoming'] } },
    orderBy: [{ status: 'asc' }, { year: 'desc' }],
  })
}

export async function getTournamentByYear(year: number) {
  return db.tournament.findFirst({ where: { year } })
}
