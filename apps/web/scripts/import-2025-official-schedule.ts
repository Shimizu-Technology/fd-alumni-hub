import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const TOURNAMENT_NAME = 'FD Alumni Basketball Tournament'
const YEAR = 2025
const SOURCE_POOL = '2025_FDMSA_Alumni_Basketball_POOL_PLAY_final_v01_22JUN25.pdf'
const SOURCE_PLAYOFF = '2025_FDMSA_Alumni_Basketball_PLAYOFFS_final_v01_09JUL25.pdf'

type ParsedGame = {
  date: string // YYYY-MM-DD
  time: string // h:mmam/pm
  code: string
  home: string
  away: string
  phase: 'pool' | 'playoff'
  bracketCode?: string | null
}

const poolText = `
Friday, June 27, 2025
1 — 6:00pm — 79/80 vs. 84/85
2 — 7:10pm — 02/04 vs. 2013
3 — 8:20pm — 2025 vs. 2016/17
Saturday, June 28, 2025
4 — 12:10pm — 2015 vs. 2018/19
5 — 1:20pm — 08/09 vs. 2014
FS01 — 2:30pm — FS1 vs. FS3
6 — 3:40pm — 1991 vs. 98
7 — 4:50pm — 82/86/AD7/92 vs. 1988
8 — 6:00pm — 2007 vs. 05
9 — 7:10pm — 12 Pack vs. 2010
10 — 8:20pm — 2022 vs. 2023
Sunday, June 29, 2025
11 — 12:10pm — 2021 vs. 2024
12 — 1:20pm — 60s vs. 60s
13 — 2:30pm — 2020 vs. 2023
14 — 3:40pm — 75 vs. 1989
15 — 4:50pm — 430-5 vs. 96/97
16 — 6:00pm — 02/04 vs. 2006
17 — 7:10pm — 2022 vs. 2025
18 — 8:20pm — 2016/17 vs. 2018/19
Monday, June 30, 2025
19 — 6:00pm — 2020 vs. 2021
20 — 7:10pm — 2024 vs. 12 Pack
21 — 8:20pm — 98 vs. 99/01/03
Tuesday, July 1, 2025
22 — 6:00pm — 84/85 vs. 96/97
23 — 7:10pm — 2007 vs. 2006
24 — 8:20pm — 2023 vs. 2025
Wednesday, July 2, 2025
25 — 6:00pm — 79/80 vs. 1988
26 — 7:10pm — 1991 vs. 1989
27 — 8:20pm — 12 Pack vs. 2013
Thursday, July 3, 2025
28 — 6:00pm — 75 vs. 82/86/AD7/92
29 — 7:10pm — 98 vs. 430-5
30 — 8:20pm — 2014 vs. 2018/19
Friday, July 4, 2025
31 — 6:00pm — 96/97 vs. 99/01/03
32 — 7:10pm — 02/04 vs. 05
33 — 8:20pm — 2013 vs. 2016/17
Saturday, July 5, 2025
34 — 12:10pm — 60s vs. 60s
35 — 1:20pm — 1988 vs. 1989
FS02 — 2:30pm — FS1 vs. FS2
36 — 3:40pm — 2014 vs. 2015
37 — 4:50pm — 79/80 vs. 82/86/AD7/92
38 — 6:00pm — 2023 vs. 2024
39 — 7:10pm — 2006 vs. 08/09
40 — 8:20pm — 2021 vs. 2022
Sunday, July 6, 2025
41 — 1:20pm — 2020 vs. 2024
42 — 2:30pm — 75 vs. 84/85
43 — 3:40pm — 2015 vs. 2016/17
44 — 4:50pm — 05 vs. 2010
45 — 6:00pm — 02/04 vs. 2007
46 — 7:10pm — 12 Pack vs. 2014
47 — 8:20pm — 2021 vs. 2018/19
Monday, July 7, 2025
48 — 6:00pm — 430-5 vs. 1991
FS03 — 7:10pm — FS2 vs. FS3
49 — 8:20pm — 2020 vs. 2022
Tuesday, July 8, 2025
50 — 6:00pm — 96/97 vs. 98
51 — 7:10pm — 08/09 vs. 2015
52 — 8:20pm — 2007 vs. 2010
Wednesday, July 9, 2025
53 — 6:00pm — 60 FS vs. 60S FS
54 — 7:10pm — 75 vs. 79/80
55 — 8:20pm — 430-5 vs. 99/01/03
Thursday, July 10, 2025
56 — 6:00pm — 84/85 vs. 1988
57 — 7:10pm — 82/86/AD7/92 vs. 1989
58 — 8:20pm — 2013 vs. 2025
Friday, July 11, 2025
59 — 6:00pm — 1991 vs. 99/01/03
60 — 7:10pm — 2006 vs. 05
61 — 8:20pm — 08/09 vs. 2010
`

const playoffText = `
Saturday, July 12, 2025
MP1 11:00am 2014 vs. 2024
MP2 12:10pm 2016/17 vs. 2020
MP3 1:20pm 2007 vs. 08/09
PP1 2:30pm 75 vs. 1988
MP4 3:40pm 2025 vs. 2022
MP5 4:50pm 18/19 vs. 2023
PP2 6:00pm 1989 vs. 84/85
MP6 7:10pm 12 Pack vs. 2021
MP7 8:20pm 2013 vs. 2015
Sunday, July 13, 2025
GP1 12:10pm 91 vs. 430-5
MP8 1:20pm 2006 vs. 2010
MP9 2:30pm 02/04 vs. WMP1
GP2 3:40pm 96/97/2000 vs. 05
MP10 4:50pm WMP5 vs. WMP4
MP11 6:00pm WMP2 vs. WMP3
Monday, July 14, 2025
PP3 6:00pm 79/80 vs WPP1
MP12 7:10pm WMP7 vs WMP8
MP13 8:20pm WMP9 vs. WMP6
Tuesday, July 15, 2025
PP4 6:00pm 82/86/AD7/92 vs. WPP2
GP3 7:10pm 99/01/03 vs. WGP1
GP4 8:20pm 98 vs. WGP2
Wednesday, July 16, 2025
MP14 6:30pm WMP11 vs. WMP12
MP15 7:45pm WMP10 vs. WMP13
Thursday, July 17, 2025
TBD0 6:00pm TBD vs. TBD
PP5 7:10pm WPP3 vs. WPP4
GP5 8:20pm WGP3 vs. WGP4
Friday, July 18, 2025
FSF 6:00pm FS vs. FS
P95 7:10pm 95 vs. 90
MP16 8:20pm WMP14 vs. WMP15
`

function toISODate(dateLine: string): string {
  const d = new Date(`${dateLine} 12:00:00 GMT+10`)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

function parsePool(text: string): ParsedGame[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  let currentDate = ''
  const out: ParsedGame[] = []
  for (const line of lines) {
    if (/^[A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(line)) {
      currentDate = toISODate(line)
      continue
    }
    const m = line.match(/^([A-Z0-9]+)\s+—\s+(\d{1,2}:\d{2}[ap]m)\s+—\s+(.+?)\s+vs\.\s+(.+)$/i)
    if (!m || !currentDate) continue
    const [, code, time, home, away] = m
    out.push({
      date: currentDate,
      time: time.toLowerCase(),
      code,
      home: home.trim(),
      away: away.trim(),
      phase: 'pool',
      bracketCode: code.startsWith('FS') ? 'FS' : null,
    })
  }
  return out
}

function parsePlayoffs(text: string): ParsedGame[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  let currentDate = ''
  const out: ParsedGame[] = []
  for (const line of lines) {
    if (/^[A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(line)) {
      currentDate = toISODate(line)
      continue
    }
    const m = line.match(/^([A-Z0-9]+)\s+(\d{1,2}:\d{2}[ap]m)\s+(.+?)\s+vs\.?\s+(.+)$/i)
    if (!m || !currentDate) continue
    const [, code, time, home, away] = m
    const bracket = /^(MP|GP|PP|WMP|WGP|WPP|FS)$/i.test(code) ? code.toUpperCase() : code.toUpperCase().replace(/\d+$/, '')
    out.push({
      date: currentDate,
      time: time.toLowerCase(),
      code,
      home: home.trim(),
      away: away.trim(),
      phase: 'playoff',
      bracketCode: bracket,
    })
  }
  return out
}

function inferDivision(team: string, bracketCode?: string | null): string {
  if (team.toUpperCase().includes('FS')) return 'Special'
  if (bracketCode?.startsWith('MP') || bracketCode?.startsWith('WMP')) return 'Maroon'
  if (bracketCode?.startsWith('GP') || bracketCode?.startsWith('WGP')) return 'Gold'
  if (bracketCode?.startsWith('PP') || bracketCode?.startsWith('WPP')) return 'Platinum'

  const match = team.match(/\d{1,4}/)
  if (!match) return 'Special'
  let year = Number(match[0])
  if (year < 100) year = year <= 30 ? 2000 + year : 1900 + year
  return year >= 2002 ? 'Maroon' : 'Gold'
}

function toStartTime(date: string, time12h: string): Date {
  const m = time12h.match(/^(\d{1,2}):(\d{2})(am|pm)$/i)
  if (!m) throw new Error(`Invalid time: ${time12h}`)
  let h = Number(m[1])
  const min = m[2]
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return new Date(`${date}T${String(h).padStart(2, '0')}:${min}:00+10:00`)
}

async function ensureTournament() {
  return prisma.tournament.upsert({
    where: { year_name: { year: YEAR, name: TOURNAMENT_NAME } },
    update: { status: 'completed' },
    create: {
      year: YEAR,
      name: TOURNAMENT_NAME,
      status: 'completed',
      startDate: new Date(`${YEAR}-06-27T00:00:00+10:00`),
      endDate: new Date(`${YEAR}-07-18T23:59:59+10:00`),
    },
  })
}

async function ensureTeam(tournamentId: string, label: string, division: string) {
  const raw = label.trim()
  const displayName = /^Class\s/i.test(raw) ? raw : `Class ${raw}`
  return prisma.team.upsert({
    where: { tournamentId_displayName: { tournamentId, displayName } },
    update: { division, classYearLabel: raw },
    create: {
      tournamentId,
      classYearLabel: raw,
      displayName,
      division,
    },
  })
}

async function upsertGame(tournamentId: string, g: ParsedGame) {
  const division = inferDivision(g.home, g.bracketCode)
  const home = await ensureTeam(tournamentId, g.home, division)
  const away = await ensureTeam(tournamentId, g.away, inferDivision(g.away, g.bracketCode))
  const startTime = toStartTime(g.date, g.time)

  const existing = await prisma.game.findFirst({
    where: {
      tournamentId,
      homeTeamId: home.id,
      awayTeamId: away.id,
      startTime,
    },
  })

  const baseData: Prisma.GameUncheckedCreateInput = {
    tournamentId,
    homeTeamId: home.id,
    awayTeamId: away.id,
    startTime,
    status: existing?.status === 'final' ? 'final' : 'scheduled',
    venue: 'FD Jungle',
    division,
    bracketCode: g.bracketCode ?? null,
    notes: [
      `phase=${g.phase}`,
      `code=${g.code}`,
      `sources=${g.phase === 'pool' ? SOURCE_POOL : SOURCE_PLAYOFF}`,
    ].join(' | '),
  }

  if (existing) {
    await prisma.game.update({
      where: { id: existing.id },
      data: {
        venue: baseData.venue,
        division: baseData.division,
        bracketCode: baseData.bracketCode,
        notes: baseData.notes,
      },
    })
    return 'updated'
  }

  await prisma.game.create({ data: baseData })
  return 'created'
}

async function main() {
  const tournament = await ensureTournament()
  const poolGames = parsePool(poolText)
  const playoffGames = parsePlayoffs(playoffText)
  const all = [...poolGames, ...playoffGames]

  let created = 0
  let updated = 0

  for (const game of all) {
    const r = await upsertGame(tournament.id, game)
    if (r === 'created') created++
    else updated++
  }

  const divisionCounts = await prisma.game.groupBy({
    by: ['division'],
    where: { tournamentId: tournament.id },
    _count: { _all: true },
  })

  const bracketCounts = await prisma.game.groupBy({
    by: ['bracketCode'],
    where: { tournamentId: tournament.id },
    _count: { _all: true },
  })

  console.log({
    tournamentId: tournament.id,
    imported: all.length,
    created,
    updated,
    divisionCounts,
    bracketCounts,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
