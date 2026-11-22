import championsData from '../../../data/historical/fd-alumni-champions.json'
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

export const STATIC_CHAMPIONS: StaticChampionSeed[] = championsData as StaticChampionSeed[]

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
    const slugParts = [
      String(seed.year),
      seed.editionLabel?.toLowerCase(),
      bracket !== 'overall' && bracket !== 'unknown' ? bracket : null,
    ].filter(Boolean)

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
  }).sort((a, b) => b.year - a.year || Number(b.primary) - Number(a.primary) || a.position - b.position)
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
