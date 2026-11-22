import type { Game, RosterEntry, Tournament } from './types'

export const boxScoreMetrics = [
  { key: 'points', short: 'PTS', label: 'Points', max: 200 },
  { key: 'rebounds', short: 'REB', label: 'Rebounds', max: 200 },
  { key: 'assists', short: 'AST', label: 'Assists', max: 200 },
  { key: 'steals', short: 'STL', label: 'Steals', max: 200 },
  { key: 'blocks', short: 'BLK', label: 'Blocks', max: 200 },
  { key: 'threePointersMade', short: '3PM', label: 'Three-pointers made', max: 200 },
  { key: 'fouls', short: 'PF', label: 'Fouls', max: 10 },
  { key: 'minutes', short: 'MIN', label: 'Minutes', max: 120 },
] as const

export type BoxScoreMetric = typeof boxScoreMetrics[number]['key']
export type BoxScoreCoverage = 'selected_scorers' | 'full_box_score'
export type BoxScoreStatus = 'none' | 'draft' | 'published' | 'needs_review'

export const boxScoreCoverageLabels: Record<BoxScoreCoverage, string> = {
  selected_scorers: 'Selected scorers',
  full_box_score: 'Full box score',
}

export type PlayerStat = Record<BoxScoreMetric, number | null> & {
  rosterEntryId: string
  teamId: string
  playerName: string
  jerseyNumber: string | null
}

export type AdminBoxScore = {
  game: Game
  enablePlayerStats: boolean
  boxScoreStatus: BoxScoreStatus
  boxScoreCoverage: BoxScoreCoverage | null
  boxScorePublishedAt: string | null
  homeRoster: RosterEntry[]
  awayRoster: RosterEntry[]
  stats: (PlayerStat & { notes: string | null })[]
  discrepancies: {
    homePointsSum: number
    awayPointsSum: number
    homeOfficialScore: number | null
    awayOfficialScore: number | null
    hasDiscrepancy: boolean
    warnings: string[]
  }
}

export type BoxScoreEntry = Partial<Record<BoxScoreMetric, string | number | null>> & {
  rosterEntryId: string
  notes?: string | null
  remove?: boolean
}

export type BoxScoreUpdate = {
  coverage: BoxScoreCoverage
  status: 'draft' | 'published'
  entries: BoxScoreEntry[]
}

export type PublicBoxScore = {
  game: Omit<Game, 'notes'>
  coverage: BoxScoreCoverage
  underReview: boolean
  publishedAt: string | null
  homeStats: PlayerStat[]
  awayStats: PlayerStat[]
}

export type LeaderMetric = 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'three_pointers_made'
export type LeaderScope = 'official' | 'all'

export type StatLeadersResponse = {
  tournament: Tournament | null
  enabled: boolean
  metric: LeaderMetric
  division: string | null
  scope: LeaderScope
  totalFinalGames: number
  gamesWithBoxScores: number
  fullBoxScoreGames: number
  metricRecordedGames: number
  isPartialCoverage: boolean
  coverageLabel: string
  leaders: {
    rank: number
    rosterEntryId: string
    playerName: string
    jerseyNumber: string | null
    teamId: string
    teamName: string
    division: string | null
    gamesRecorded: number
    total: number
    average: number
  }[]
}
