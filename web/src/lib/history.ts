import type { Team, TournamentChampion } from './types'

export type ChampionRecord = TournamentChampion

export function classRouteKey(value?: string | null) {
  return canonicalClassKey(value).replaceAll('/', '-')
}

export function classKeyFromRoute(value?: string | null) {
  return canonicalClassKey(value?.replaceAll('-', '/'))
}

export function classDisplayLabel(value?: string | null) {
  const key = canonicalClassKey(value)
  if (!key) return 'Class archive'
  return `Class of ${key.split('/').map((segment, index) => formatClassSegment(segment, index)).join('/')}`
}

export function titleRecordsForTeam(team: Pick<Team, 'displayName' | 'classYearLabel'>, records: TournamentChampion[]) {
  const aliases = new Set([canonicalClassKey(team.displayName), canonicalClassKey(team.classYearLabel)].filter(Boolean))
  return records.filter((record) => record.championKey && aliases.has(canonicalClassKey(record.championKey)))
}

function formatClassSegment(segment: string, index: number) {
  if (!/^\d{2}$/.test(segment)) return segment.toUpperCase()
  if (index > 0) return segment
  return `${Number(segment) >= 50 ? '19' : '20'}${segment}`
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
