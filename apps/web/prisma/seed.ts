import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const year = new Date().getFullYear()
  const tournament = await prisma.tournament.upsert({
    where: { year_name: { year, name: 'FD Alumni Basketball Tournament' } },
    update: {},
    create: {
      name: 'FD Alumni Basketball Tournament',
      year,
      status: 'upcoming',
      startDate: new Date(`${year}-06-28T00:00:00.000Z`),
      endDate: new Date(`${year}-07-19T23:59:59.000Z`),
    },
  })

  const teams = ['Class of 2014', 'Class of 2015', 'Class of 2016', 'Class of 2017']
  for (const displayName of teams) {
    await prisma.team.upsert({
      where: { tournamentId_displayName: { tournamentId: tournament.id, displayName } },
      update: {},
      create: {
        tournamentId: tournament.id,
        classYearLabel: displayName.replace('Class of ', ''),
        displayName,
        division: 'Open',
      },
    })
  }

  console.log('Seeded tournament:', tournament.id)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
