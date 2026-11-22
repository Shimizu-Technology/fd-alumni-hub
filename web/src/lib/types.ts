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

export type ClassCohort = {
  id: string
  key: string
  routeKey: string
  graduationYear: number
  displayName: string
  shortLabel: string
  createdAt?: string
  updatedAt?: string
}

export type Team = {
  id: string
  tournamentId: string
  tournamentYear?: number | null
  classYearLabel: string
  displayName: string
  classCohorts: ClassCohort[]
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

export type TeamSummary = Pick<Team, 'id' | 'displayName' | 'classYearLabel' | 'classCohorts' | 'divisionId' | 'division'> & { rosterEntries?: RosterEntry[] }

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
  creditedClasses: ClassCohort[]
  runnerUpLabel: string | null
  runnerUpKey: string | null
  score: string | null
  bracket: 'overall' | 'maroon' | 'gold' | 'platinum' | 'unknown'
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
  componentClasses: ClassCohort[]
}

export type HostCampaignStatus = 'draft' | 'active' | 'closing' | 'archived'
export type CampaignEventKind = 'fundraiser' | 'host_night' | 'golf' | 'merch_drop' | 'meeting' | 'other'
export type CampaignEventStatus = 'planned' | 'open' | 'sold_out' | 'completed' | 'cancelled'
export type HafapassTicketState = 'on_sale' | 'sold_out' | 'upcoming' | 'sales_ended' | 'cancelled'

export type HostCampaignMeter =
  | { enabled: false }
  | {
      enabled: true
      goalCents: number
      raisedCents: number
      percent: number
      goalReached: boolean
      updatedAt: string | null
    }

export type HafapassTicketType = {
  name: string
  allInPriceCents: number | null
  quantityRemaining: number | null
  onSale: boolean
}

export type HafapassEventSummary = {
  id: string
  slug: string | null
  title: string
  shortDescription: string | null
  startsAt: string | null
  endsAt: string | null
  venueName: string | null
  venueCity: string | null
  organizerSlug: string | null
  isPass: boolean
  seriesSlug: string | null
  ticketState: HafapassTicketState | null
  minAllInPriceCents: number | null
  ticketTypes: HafapassTicketType[]
  availabilityLabel: string | null
  buyUrl: string | null
}

export type PublicHostCampaign = {
  id: string
  slug: string
  title: string
  tagline: string | null
  description: string | null
  status: HostCampaignStatus
  featured: boolean
  tournament: Tournament | null
  hostClass: ClassCohort | null
  countdownTargetAt: string | null
  countdownLabel: string | null
  heroImageUrl: string | null
  donationUrl: string | null
  donationInstructions: string | null
  golfUrl: string | null
  meter: HostCampaignMeter
}

export type PublicCampaignEvent = {
  id: string
  kind: CampaignEventKind
  title: string
  startsAt: string | null
  endsAt: string | null
  dateLabel: string | null
  venue: string | null
  description: string | null
  imageUrl: string | null
  hafapassEventId: string | null
  hafapassEventSlug: string | null
  hafapassDistributionCode: string | null
  externalUrl: string | null
  ctaLabel: string | null
  status: CampaignEventStatus
  position: number
  hafapass?: HafapassEventSummary | null
}

export type PublicCampaignPost = {
  id: string
  title: string
  body: string
  imageUrl: string | null
  publishedAt: string | null
  pinned: boolean
  authorName: string | null
}

export type HomeHostCampaignSummary = {
  slug: string
  title: string
  tagline: string | null
  status: HostCampaignStatus
  hostClass: ClassCohort | null
  countdownTargetAt: string | null
  countdownLabel: string | null
  donationUrl: string | null
  golfUrl: string | null
  meter: HostCampaignMeter
  nextEvent: PublicCampaignEvent | null
}

export type HostYearResponse = {
  campaign: PublicHostCampaign
  events: PublicCampaignEvent[]
  posts: PublicCampaignPost[]
  hafapass: {
    available: boolean
    stale: boolean
    fetchedAt: string | null
    allTicketsUrl?: string | null
    events: HafapassEventSummary[]
  }
}

export type CampaignRole = 'chair' | 'treasurer' | 'board'

export type UserCampaignMembership = {
  campaignId: string
  campaignSlug: string
  campaignTitle: string
  status: HostCampaignStatus
  roles: CampaignRole[]
}

export type AdminHostCampaign = PublicHostCampaign & {
  tournamentId: string
  classCohortId: string
  goalCents: number
  hafapassOrganizerSlug: string | null
  hafapassTournamentOrganizerSlug: string | null
  hafapassDistributionCode: string | null
  fdaaUpfrontCents: number
  fdaaTicketShareBps: number
  publicMeterEnabled: boolean
  includeFdaaInPublicMeter: boolean
  createdAt?: string
  updatedAt?: string
}

export type AdminCampaignEvent = PublicCampaignEvent & {
  hostCampaignId: string
  publicVisible: boolean
  goalCents: number | null
  archivedAt: string | null
  createdAt?: string
  updatedAt?: string
}

export type AdminCampaignPost = PublicCampaignPost & {
  hostCampaignId: string
  authorId: string | null
  published: boolean
  createdAt?: string
  updatedAt?: string
}

export type CampaignMembershipRecord = {
  id: string
  hostCampaignId: string
  userId: string
  userEmail: string | null
  userName: string | null
  role: CampaignRole
  active: boolean
  invitedById: string | null
  createdAt?: string
  updatedAt?: string
}

export type AdminUserSummary = {
  id: string
  email: string
  fullName: string
  role: string
}

export type CampaignInvitationRecord = {
  id: string
  hostCampaignId: string
  email: string
  role: CampaignRole
  status: 'pending' | 'accepted' | 'revoked'
  invitedById: string
  invitedByName: string | null
  acceptedAt: string | null
  acceptedByUserId: string | null
  revokedAt: string | null
  createdAt?: string
  updatedAt?: string
}

export type AdminWhitelistRecord = {
  id: string
  email: string
  role: 'admin' | 'staff' | 'viewer'
  active: boolean
  notes: string | null
  createdAt?: string
  updatedAt?: string
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
  campaignMemberships?: UserCampaignMembership[]
}

export type ApiErrorPayload = {
  error?: string
  errors?: string[] | Array<{ id?: string; errors: string[] }>
}
