export type TournamentStatus = 'upcoming' | 'live' | 'completed' | 'cancelled'
export type GameStatus = 'scheduled' | 'live' | 'final'
export type IngestStatus = 'pending' | 'approved' | 'rejected'
export type IngestKind = 'article' | 'media'

export type Division = {
  id: string
  name: string
  slug: string
  startsYear: number | null
  position: number
  active: boolean
  available?: boolean
  createdAt?: string
  updatedAt?: string
}

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
  tournamentYear?: number | null
  classYearLabel: string
  displayName: string
  divisionId?: string | null
  division: string | null
  rosterEntries?: RosterEntry[]
  createdAt?: string
  updatedAt?: string
}

export type RosterEntry = {
  id: string
  teamId: string
  name: string
  jerseyNumber: string | null
  position: string | null
  nickname: string | null
  sortOrder: number
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export type GameDayNote = {
  id: string
  tournamentId: string
  date: string
  hostClass: string | null
  foodMenu: string | null
  announcement: string | null
  sponsorShoutout: string | null
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export type TeamSummary = Pick<Team, 'id' | 'displayName' | 'classYearLabel' | 'divisionId' | 'division'> & { rosterEntries?: RosterEntry[] }

export type RelatedGameSummary = {
  id: string
  tournamentId: string
  startTime: string
  venue: string | null
  status: GameStatus
  homeScore: number | null
  awayScore: number | null
  homeTeam?: TeamSummary | null
  awayTeam?: TeamSummary | null
}

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
  divisionId?: string | null
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
  gameId: string | null
  game?: RelatedGameSummary | null
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
  gameId: string | null
  game?: RelatedGameSummary | null
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

export type PredictionOption = {
  teamId: string
  displayName: string
  classYearLabel: string
  division: string | null
  selected: boolean
  votes: number | null
  percent: number | null
}

export type PredictionPoll = {
  id: string
  tournamentId: string
  gameId: string | null
  pollType: 'game' | 'tournament'
  question: string
  status: 'open' | 'closed'
  open: boolean
  closesAt: string | null
  totalVotes: number | null
  selectedTeamId: string | null
  game?: RelatedGameSummary | null
  options: PredictionOption[]
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

export type TournamentChampion = {
  id: string
  tournamentId: string | null
  year: number
  editionLabel: string | null
  label: string
  championLabel: string | null
  championKey: string | null
  championComponents: string[]
  runnerUpLabel: string | null
  runnerUpKey: string | null
  score: string | null
  bracket: 'overall' | 'maroon' | 'gold' | 'unknown'
  primary: boolean
  status: 'completed' | 'cancelled' | 'research_pending' | 'upcoming' | 'unknown'
  source: string
  notes: string | null
  position: number
  createdAt?: string
  updatedAt?: string
}

export type TitleCount = {
  championKey: string
  championLabel: string
  titles: number
  years: number[]
  records: TournamentChampion[]
}

export type ClassProfile = {
  classKey: string
  routeKey: string
  displayName: string
  titleCount: number
  titleYears: number[]
  teamCount: number
  latestTournamentYear: number | null
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
