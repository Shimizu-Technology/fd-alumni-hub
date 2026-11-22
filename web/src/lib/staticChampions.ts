import type { TitleCount, TournamentChampion } from './types'

export type StaticChampionSeed = {
  year: number
  editionLabel?: string
  bracket?: 'overall' | 'maroon' | 'gold' | 'platinum' | 'unknown'
  primary?: boolean
  champion: string
  runnerUp?: string
  score?: string
  status?: 'completed' | 'cancelled'
  source: string
  notes?: string
}

// Mirrors data/historical/fd-alumni-champions.json so the public History and
// Home pages preserve verified champion history even when the live API is paused.
export const STATIC_CHAMPIONS: StaticChampionSeed[] = [
  { year: 1985, champion: 'Class of 1974', source: 'FD alumni champions graphic' },
  { year: 1986, champion: 'Class of 1974', source: 'FD alumni champions graphic' },
  { year: 1987, editionLabel: 'Spring', champion: 'Class of 1980', source: 'FD alumni champions graphic' },
  { year: 1987, editionLabel: 'Summer', champion: 'Class of 1982', source: 'FD alumni champions graphic' },
  { year: 1987, editionLabel: 'Fall', champion: 'Class of 1979', source: 'FD alumni champions graphic' },
  { year: 1988, champion: 'Class of 1982', source: 'FD alumni champions graphic' },
  { year: 1989, champion: 'Class of 1980', source: 'FD alumni champions graphic' },
  { year: 1991, champion: 'Class of 1991', source: 'FD alumni champions graphic' },
  { year: 1992, champion: 'Class of 1982', source: 'FD alumni champions graphic' },
  { year: 1993, champion: 'Class of 1991', source: 'FD alumni champions graphic' },
  { year: 1994, champion: 'Class of 1982', source: 'FD alumni champions graphic' },
  { year: 1995, champion: 'Class of 1982', source: 'FD alumni champions graphic' },
  { year: 1996, champion: 'Class of 1982', source: 'FD alumni champions graphic' },
  { year: 1997, champion: 'Class of 1991', source: 'FD alumni champions graphic' },
  { year: 1998, champion: 'Class of 1982', source: 'FD alumni champions graphic' },
  { year: 1999, champion: 'Class of 1995/96', source: 'FD alumni champions graphic' },
  { year: 2000, champion: 'Class of 1996', source: 'FD alumni champions graphic' },
  { year: 2001, champion: 'Class of 1991', source: 'FD alumni champions graphic' },
  { year: 2002, champion: 'Class of 1996', source: 'FD alumni champions graphic' },
  { year: 2003, champion: 'Class of 1996', source: 'FD alumni champions graphic' },
  { year: 2004, champion: 'Class of 1995', source: 'FD alumni champions graphic' },
  { year: 2005, champion: 'Class of 1991', source: 'FD alumni champions graphic' },
  { year: 2006, champion: 'Class of 2002/03', source: 'FD alumni champions graphic' },
  { year: 2007, champion: 'Class of 2006', source: 'FD alumni champions graphic' },
  { year: 2008, champion: 'Class of 1995', source: 'FD alumni champions graphic' },
  { year: 2009, champion: 'Class of 2002', source: 'FD alumni champions graphic' },
  { year: 2010, champion: 'Class of 2006', source: 'FD alumni champions graphic' },
  { year: 2011, champion: 'Class of 2006', source: 'FD alumni champions graphic' },
  { year: 2012, champion: 'Class of 2006', source: 'FD alumni champions graphic' },
  { year: 2013, champion: 'Class of 2006', source: 'FD alumni champions graphic' },
  { year: 2014, champion: 'Class of 2004', source: 'FD alumni champions graphic / GSPN' },
  { year: 2015, champion: 'Class of 2013', score: '60-48', source: 'FD alumni champions graphic / GSPN' },
  { year: 2016, champion: 'Class of 2006', source: 'FD alumni champions graphic' },
  { year: 2017, champion: 'Class of 2002/04', source: 'FD alumni champions graphic / GSPN' },
  { year: 2018, champion: 'Class of 2002/04', source: 'FD alumni champions graphic / GSPN' },
  { year: 2019, champion: 'Class of 2006', source: 'FD alumni champions graphic / GSPN' },
  { year: 2020, status: 'cancelled', champion: 'Tournament cancelled', source: 'FD alumni champions graphic', notes: 'Tournament cancelled because of COVID-19.' },
  { year: 2021, champion: 'Class of 2006', runnerUp: 'Class of 2002/04', score: '58-38', source: 'FD alumni champions graphic / GSPN' },
  { year: 2022, champion: 'Class of 2002/04', runnerUp: 'Class of 2020', score: '62-52', source: 'GSPN / WhatsApp confirmation' },
  { year: 2023, champion: 'Class of 2013', source: 'WhatsApp confirmation' },
  { year: 2024, champion: 'Class of 2016/17', runnerUp: 'Class of 2013', score: '58-56', source: 'GSPN / WhatsApp confirmation' },
  { year: 2025, champion: 'Class of 2002/04', runnerUp: 'Class of 2013', score: '50-44', source: 'GuamPDN / WhatsApp confirmation' },
  { year: 2026, bracket: 'maroon', primary: true, champion: 'Class of 2025', runnerUp: 'Class of 2013', score: '61-49', source: 'GSPN' },
  { year: 2026, bracket: 'gold', primary: false, champion: 'Class of 1999/01/03', runnerUp: 'Class of 2005', notes: 'Won in overtime.', source: 'GSPN' },
  { year: 2026, bracket: 'platinum', primary: false, champion: 'Class of 1991', runnerUp: 'Class of 1988', score: '41-20', source: 'GSPN' },
]

function canonicalKey(label?: string): string {
  if (!label) return ''
  const cleaned = label.toLowerCase().replace(/class\s+of/g, '').replace(/class/g, '').replace(/[’']/g, '').trim()
  const segments = cleaned.match(/ad\d+|\d{2,4}/g) || []
  if (!segments.length) return ''
  return segments.map((segment) => (segment.startsWith('ad') ? segment : segment.length === 4 ? segment.slice(-2) : segment.padStart(2, '0'))).join('/')
}

function classDisplayFromKey(key: string): string {
  const num = Number(key)
  if (!Number.isFinite(num)) return `Class of ${key.toUpperCase()}`
  const year = num >= 60 ? 1900 + num : 2000 + num
  return `Class of ${year}`
}

function labelFor(seed: StaticChampionSeed): string {
  if (seed.editionLabel) return `${seed.year} ${seed.editionLabel}`
  if (seed.bracket && seed.bracket !== 'overall' && seed.bracket !== 'unknown') {
    return `${seed.year} ${seed.bracket.charAt(0).toUpperCase()}${seed.bracket.slice(1)}`
  }
  return String(seed.year)
}

export function staticChampionRecords(): TournamentChampion[] {
  return STATIC_CHAMPIONS.map((seed, index) => {
    const bracket = seed.bracket || 'overall'
    const status = seed.status || 'completed'
    const championKey = status === 'cancelled' ? '' : canonicalKey(seed.champion)
    const components = championKey ? championKey.split('/').filter(Boolean) : []
    const slugParts = [String(seed.year), seed.editionLabel?.toLowerCase(), bracket !== 'overall' ? bracket : null].filter(Boolean)

    return {
      id: `static-${slugParts.join('-')}`,
      tournamentId: null,
      year: seed.year,
      editionLabel: seed.editionLabel || null,
      label: labelFor(seed),
      championLabel: seed.champion,
      championKey: championKey || null,
      championComponents: components,
      creditedClasses: [],
      runnerUpLabel: seed.runnerUp || null,
      runnerUpKey: canonicalKey(seed.runnerUp) || null,
      score: seed.score || null,
      bracket,
      primary: seed.primary ?? true,
      status,
      source: seed.source,
      notes: seed.notes || null,
      position: index + 1,
    }
  }).sort((a, b) => b.year - a.year || a.position - b.position)
}

export function staticChampionsForYear(year: number): TournamentChampion[] {
  return staticChampionRecords().filter((record) => record.year === year)
}

export function staticTitleCounts(): TitleCount[] {
  const byClass = new Map<string, TournamentChampion[]>()

  staticChampionRecords()
    .filter((record) => record.status === 'completed' && record.primary && record.championComponents.length > 0)
    .forEach((record) => {
      record.championComponents.forEach((key) => {
        const list = byClass.get(key) || []
        list.push(record)
        byClass.set(key, list)
      })
    })

  return Array.from(byClass.entries())
    .map(([key, records]) => ({
      championKey: key,
      championLabel: classDisplayFromKey(key),
      titles: records.length,
      years: Array.from(new Set(records.map((record) => record.year))).sort((a, b) => b - a),
      records,
    }))
    .sort((a, b) => b.titles - a.titles || a.championLabel.localeCompare(b.championLabel))
}
