import type { Team, TournamentChampion } from './types'

export type ChampionRecord = TournamentChampion

export function titleRecordsForTeam(team: Pick<Team, 'displayName' | 'classYearLabel'>, records: TournamentChampion[]) {
  const aliases = new Set([canonicalClassKey(team.displayName), canonicalClassKey(team.classYearLabel)].filter(Boolean))
  return records.filter((record) => record.championKey && aliases.has(canonicalClassKey(record.championKey)))
}

export function canonicalClassKey(value?: string | null) {
  if (!value) return ''

  const cleaned = value
    .toLowerCase()
    .replace(/class\s+of/g, '')
    .replace(/class/g, '')
    .replace(/[’']/g, '')
    .trim()

  const numericSegments = cleaned.match(/ad\d+|\d{2,4}/g)
  if (numericSegments?.length) {
    return numericSegments.map((segment) => {
      if (segment.startsWith('ad')) return segment
      return segment.length === 4 ? segment.slice(2) : segment.padStart(2, '0')
    }).join('/')
  }

  return cleaned.replace(/[^a-z0-9]+/g, '')
}
