export type TournamentStatus = 'upcoming' | 'live' | 'completed' | 'cancelled'
export type GameStatus = 'scheduled' | 'live' | 'final'
export type IngestStatus = 'pending' | 'approved' | 'rejected'
export type IngestKind = 'article' | 'media'

export type Tournament = {
  id: string
  name: string
  year: number
  startDate: string
  endDate: string
  status: TournamentStatus
  createdAt?: string
  updatedAt?: string
}

export type Team = {
  id: string
  tournamentId: string
  classYearLabel: string
  displayName: string
  division: string | null
  createdAt?: string
  updatedAt?: string
}

export type TeamSummary = Pick<Team, 'id' | 'displayName' | 'classYearLabel' | 'division'>

export type Game = {
  id: string
  tournamentId: string
  homeTeamId: string
  awayTeamId: string
  startTime: string
  venue: string | null
  status: GameStatus
  homeScore: number | null
  awayScore: number | null
  streamUrl: string | null
  ticketUrl: string | null
  notes: string | null
  division: string | null
  bracketCode: string | null
  placeholder?: boolean
  createdAt?: string
  updatedAt?: string
  homeTeam?: TeamSummary
  awayTeam?: TeamSummary
}

export type Standing = {
  id: string
  tournamentId: string
  teamId: string
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  pointDifferential: number
  updatedAt?: string
  team: TeamSummary
}

export type Article = {
  id: string
  tournamentId: string
  title: string
  source: string
  url: string
  publishedAt: string | null
  imageUrl: string | null
  excerpt: string | null
  createdAt?: string
  updatedAt?: string
}

export type MediaAsset = {
  id: string
  tournamentId: string
  source: string
  title: string
  imageUrl: string
  articleUrl: string | null
  caption: string | null
  tags: string | null
  tagList: string[]
  takenAt: string | null
  createdAt?: string
  updatedAt?: string
}

export type Sponsor = {
  id: string
  tournamentId: string
  name: string
  logoUrl: string | null
  targetUrl: string | null
  tier: string | null
  active: boolean
  position: number
  createdAt?: string
  updatedAt?: string
}

export type IngestItem = {
  id: string
  tournamentId: string
  kind: IngestKind
  status: IngestStatus
  source: string
  title: string
  url: string
  imageUrl: string | null
  excerpt: string | null
  confidence: string | null
  notes: string | null
  importedToId: string | null
  createdAt?: string
  updatedAt?: string
}

export type ScoreCoverage = {
  scoredGames: number
  totalGames: number
  percent: number
}

export type CurrentUser = {
  id: string
  clerkId: string | null
  email: string
  firstName: string | null
  lastName: string | null
  fullName: string
  role: string
  active: boolean
  isAdmin: boolean
  isStaff: boolean
}

export type ApiErrorPayload = {
  error?: string
  errors?: string[] | Array<{ id?: string; errors: string[] }>
}
