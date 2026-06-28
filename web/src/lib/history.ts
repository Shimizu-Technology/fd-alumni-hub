export type ChampionRecord = {
  year: number
  champion?: string
  runnerUp?: string
  score?: string
  source: string
  status?: 'upcoming' | 'live' | 'completed' | 'cancelled' | 'unknown'
  note?: string
}

export const CHAMPIONS: ChampionRecord[] = [
  { year: 2025, champion: 'Class of 2002/04', runnerUp: 'Class of 2013', score: '50-44', source: 'GuamPDN', status: 'completed' },
  { year: 2024, champion: 'Class of 2016/17', runnerUp: 'Class of 2002/04', score: '58-56', source: 'GSPN', status: 'completed' },
  { year: 2023, champion: 'Class of 2013', source: 'GSPN', status: 'completed' },
  { year: 2022, champion: 'Class of 2002/04', runnerUp: 'Class of 2006', score: '62-52', source: 'GSPN', status: 'completed' },
  { year: 2021, champion: 'Class of 2006', runnerUp: 'Class of 2011', score: '58-38', source: 'GSPN', status: 'completed' },
  { year: 2020, source: 'COVID-19', status: 'cancelled', note: 'Tournament cancelled' },
  { year: 2019, champion: 'Class of 2006', source: 'GSPN', status: 'completed' },
  { year: 2018, champion: 'Class of 2002/04', source: 'GSPN', status: 'completed' },
  { year: 2017, champion: 'Class of 2002/04', source: 'GSPN', status: 'completed' },
  { year: 2016, source: 'Research pending', status: 'unknown', note: 'Champion data still unverified' },
  { year: 2015, champion: 'Class of 2013', score: '60-48', source: 'GSPN', status: 'completed' },
  { year: 2014, champion: 'Class of 2004', source: 'GSPN', status: 'completed' },
]

export function titleRecordsForTeam(team: { displayName: string; classYearLabel: string }) {
  const aliases = new Set([canonicalClassKey(team.displayName), canonicalClassKey(team.classYearLabel)].filter(Boolean))
  return CHAMPIONS.filter((record) => record.champion && aliases.has(canonicalClassKey(record.champion)))
}

export function canonicalClassKey(value?: string | null) {
  if (!value) return ''

  const cleaned = value
    .toLowerCase()
    .replace(/class\s+of/g, '')
    .replace(/class/g, '')
    .replace(/[’']/g, '')
    .trim()

  const numericSegments = cleaned.match(/\d{2,4}|ad\d+/g)
  if (numericSegments?.length) {
    return numericSegments.map((segment) => {
      if (segment.startsWith('ad')) return segment
      return segment.length === 4 ? segment.slice(2) : segment.padStart(2, '0')
    }).join('/')
  }

  return cleaned.replace(/[^a-z0-9]+/g, '')
}
