export type TournamentStatus = 'upcoming' | 'live' | 'completed' | 'cancelled'
export type GameStatus = 'scheduled' | 'live' | 'final' | 'delayed' | 'postponed' | 'cancelled'
export type GameOutcome = 'regulation' | 'overtime' | 'shootout' | 'forfeit' | 'postponed' | 'cancelled'
export type GamePhase = 'pool' | 'playoff' | 'fatherson' | 'exhibition'
export type BracketRound = 'play_in' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final' | 'third_place'
export type IngestStatus = 'pending' | 'approved' | 'rejected'
export type IngestKind = 'article' | 'media'

export type Division = {
  id: string
  tournamentId?: string
  name: string
  slug: string
  countsForStandings?: boolean
  startsYear?: number | null
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

export type MenuItem = { name: string; price?: string; category?: string; available?: boolean; notes?: string }
export type SpecialEvent = { title: string; timeLabel?: string; description?: string; campaignEventId?: string }
export type HostSpotlight = { hostClassLabel?: string; headline?: string; body?: string; photoUrl?: string; hostCampaignId?: string }
export type TournamentUpdate = {
  id: string
  tournamentId: string
  title: string
  body: string
  targetDate: string | null
  status: 'draft' | 'published'
  publishedAt: string | null
  expiresAt: string | null
  pinned: boolean
}
export type InfoGuide = {
  venueName: string
  venueAddress: string
  ticketSourceName: string
  ticketSourceUrl: string
  ticketSummary: string
  doorInfo: string
  eligibilityHighlights: string[]
  gameRuleHighlights: string[]
  conductHighlights: string[]
  bylawDisclaimer: string
}
export type TonightPayload = {
  tournament: Tournament | null
  date: string
  requestedDate: string
  resolvedDate: string
  nextScheduledDate: string | null
  isRestDay: boolean
  gameDayNote: GameDayNote | null
  alerts?: TournamentAlert[]
  games: Game[]
  linkedCampaignEvents: PublicCampaignEvent[]
  updates: TournamentUpdate[]
  fallbackTicketUrl?: string | null
  predictionPolls: PredictionPoll[]
  sponsors: Sponsor[]
  lastUpdatedAt: string | null
}
export type GameDayNote = {
  id: string
  tournamentId: string
  date: string
  menuItems?: MenuItem[]
  specialEvents?: SpecialEvent[]
  hostSpotlight?: HostSpotlight
  status?: 'draft' | 'published'
  publishedAt?: string | null
  lockVersion?: number | null
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
  bracketNeedsReview?: boolean
  bracketExceptionNote?: string | null
  venue: string | null
  status: GameStatus
  homeScore: number | null
  awayScore: number | null
  resultOutcome?: GameOutcome | null
  officialWinnerTeamId?: string | null
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
  statusNote?: string | null
  phase?: GamePhase
  gameNumber?: string | null
  homeScore: number | null
  awayScore: number | null
  resultOutcome?: GameOutcome | null
  officialWinnerTeamId?: string | null
  streamUrl: string | null
  ticketUrl: string | null
  notes: string | null
  divisionId?: string | null
  division: string | null
  bracketCode: string | null
  bracketRound?: BracketRound | null
  bracketSlot?: number | null
  nextGameId?: string | null
  nextGameSlot?: 'home' | 'away' | null
  lockVersion?: number
  scoreUpdatedAt?: string | null
  scoreUpdatedByName?: string | null
  bracketNeedsReview?: boolean
  bracketExceptionNote?: string | null
  placeholder?: boolean
  createdAt?: string
  updatedAt?: string
  homeTeam?: TeamSummary
  awayTeam?: TeamSummary
}

export type BracketAdvancement = {
  advanced: boolean
  reason?: string
  nextGameId?: string
  slot?: 'home' | 'away'
  winnerTeamId?: string
  needsReview?: boolean
  affectedNextGame?: RelatedGameSummary
}

export type SavedResult = {
  game: Game
  idempotentReplay?: boolean
  standingsStatus?: 'updated' | 'skipped' | 'failed'
  recompute?: { teams: number; games: number } | null
  bracketAdvancement?: BracketAdvancement
}

export type BatchResultRow = Partial<SavedResult> & {
  gameId: string
  ok: boolean
  status: number
  currentGame?: Game
  error?: string
  errors?: string[]
}

export type AdminGamesResponse = {
  games: Game[]
  requestedDate: string | null
  nextScheduledDate: string | null
  availableDates: string[]
  pendingCorrectionCount: number
}

export type ScoreCorrectionRequest = {
  id: string
  game: RelatedGameSummary
  requestedBy: string
  status: 'pending' | 'approved' | 'rejected'
  proposedHomeScore: number | null
  proposedAwayScore: number | null
  proposedStatus: GameStatus
  proposedResultOutcome: GameOutcome | null
  proposedOfficialWinnerTeamId: string | null
  proposedStatusNote: string | null
  reason: string
}

export type Standing = {
  id: string
  tournamentId: string
  teamId: string
  rank?: number | null
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

export type SponsorTier = 'diamond' | 'platinum' | 'gold' | 'silver' | 'community'

export type Sponsor = {
  id: string
  tournamentId: string
  name: string
  logoUrl: string | null
  targetUrl: string | null
  tier: SponsorTier | string | null
  tierLabel?: string | null
  description?: string | null
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
  scoredPoolGames?: number
  totalPoolGames?: number
  scoredGames: number
  totalGames: number
  percent: number
}

export type DivisionStandingsGroup = {
  division: Division
  standings: Standing[]
  scoreCoverage: ScoreCoverage
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
  stale?: boolean
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

export type PublicTicketFundraiserItem = {
  id: string
  title: string
  shortDescription: string | null
  startsAt: string | null
  endsAt: string | null
  dateLabel: string | null
  venueName: string | null
  kind: CampaignEventKind
  status: CampaignEventStatus
  ticketState: HafapassTicketState | null
  minAllInPriceCents: number | null
  ticketTypes: HafapassTicketType[]
  availabilityLabel: string | null
  buyUrl: string | null
  ctaLabel: string | null
  stale: boolean
}

export type TicketsDoorInfo = {
  venue: string
  doorsOpenNote: string
  paymentNote: string
  reentryNote: string
  tournamentYear: number | null
}

export type AlertSeverity = 'info' | 'warning' | 'urgent'

export type TournamentAlert = {
  id: string
  tournamentId: string | null
  severity: AlertSeverity
  title: string
  message: string
  active: boolean
  startsAt: string | null
  expiresAt: string | null
  createdAt?: string
  updatedAt?: string
}

export type BracketRoundGroup = {
  round: string
  label: string
  games: Game[]
}

export type BracketDivisionGroup = {
  division: {
    id: string
    name: string
    slug: string
    position: number
  }
  rounds: BracketRoundGroup[]
}

export type PublicBracketResponse = {
  tournament: Tournament | null
  divisions: BracketDivisionGroup[]
}

export type PublicTicketsResponse = {
  tournament: Tournament | null
  campaign: {
    slug: string
    title: string
    allTicketsUrl: string | null
  } | null
  hafapass: {
    available: boolean
    stale: boolean
    fetchedAt: string | null
  }
  passes: HafapassEventSummary[]
  gameNights: HafapassEventSummary[]
  otherEvents: HafapassEventSummary[]
  fundraiserEvents: PublicTicketFundraiserItem[]
  doorInfo: TicketsDoorInfo
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
  role: 'admin' | 'staff' | 'scorekeeper' | 'viewer'
  active: boolean
  notes: string | null
  createdAt?: string
  updatedAt?: string
}

export type LedgerEntryType = 'income' | 'expense'
export type LedgerReimbursementStatus = 'not_applicable' | 'requested' | 'approved' | 'reimbursed'
export type PledgeStatus = 'promised' | 'partial' | 'fulfilled' | 'cancelled'

export type BudgetLineRecord = {
  id: string
  hostCampaignId: string
  kind: LedgerEntryType
  category: string
  budgetCents: number
  actualCents?: number
  position: number
  notes: string | null
  archivedAt: string | null
  createdAt?: string
  updatedAt?: string
}

export type PledgeRecord = {
  id: string
  hostCampaignId: string
  sponsorId: string | null
  sponsorName: string | null
  donorName: string
  contactInfo: string | null
  tier: string | null
  isInKind: boolean
  promisedCents: number
  receivedCents: number
  outstandingCents: number
  overpaymentCents: number
  dueOn: string | null
  status: PledgeStatus
  notes: string | null
  recordedById: string
  recordedByName: string | null
  createdAt?: string
  updatedAt?: string
}

export type LedgerEntryRecord = {
  id: string
  hostCampaignId: string
  entryType: LedgerEntryType
  amountCents: number
  entryDate: string
  budgetLineId: string | null
  budgetLineCategory: string | null
  campaignEventId: string | null
  campaignEventTitle: string | null
  sponsorId: string | null
  sponsorName: string | null
  pledgeId: string | null
  pledgeDonorName: string | null
  source: string
  paymentMethod: string
  counterparty: string
  description: string | null
  referenceNumber: string | null
  paidBy: string | null
  paidByUserId: string | null
  paidByUserName: string | null
  reimbursementStatus: LedgerReimbursementStatus
  reimbursementApprovedById: string | null
  reimbursementApprovedByName: string | null
  reimbursedAt: string | null
  reimbursementReference: string | null
  hasReceipt: boolean
  receiptFilename: string | null
  receiptContentType: string | null
  receiptByteSize: number | null
  recordedById: string
  recordedByName: string | null
  voided: boolean
  voidedAt: string | null
  voidedById: string | null
  voidedByName: string | null
  voidReason: string | null
  createdAt?: string
  updatedAt?: string
}

export type FinanceSummary = {
  goalCents: number
  raisedCents: number
  raisedExcludingFdaaCents: number
  spentCents: number
  netCents: number
  stillNeededCents: number
  stillNeededGrossCents: number
  publicMeterRaisedCents: number
  publicMeterEnabled: boolean
  includeFdaaInPublicMeter: boolean
  fdaaUpfrontCents: number
  fdaaTicketShareBps: number
  pledgedTotalCents: number
  pledgedReceivedCents: number
  outstandingPledgesCents: number
  inKindPledgesCount: number
  pendingReimbursementsCents: number
  pendingReimbursementsCount: number
  bySource: Array<{ entryType: LedgerEntryType; source: string; amountCents: number }>
  byMethod: Array<{ entryType: LedgerEntryType; paymentMethod: string; amountCents: number }>
  budgetVsActual: Array<{
    id: string
    kind: LedgerEntryType
    category: string
    budgetCents: number
    actualCents: number
    varianceCents: number
    archived: boolean
  }>
  mixedNetEventIds: string[]
}

export type FinanceAuditEvent = {
  id: string
  hostCampaignId: string
  actorId: string
  actorName: string | null
  actorEmail: string | null
  recordType: string
  recordId: string
  action: string
  changes: Record<string, unknown>
  reason: string | null
  createdAt: string | null
}

export type CloseoutIssue = {
  code: string
  message: string
  count: number
}

export type CampaignCloseoutCheck = {
  campaignId: string
  status: HostCampaignStatus
  unfinalizedGamesCount: number
  pendingReimbursementsCount: number
  openCashPledgesCount: number
  missingReceiptsCount: number
  championsRecordedCount: number
  liveExpensesCount: number
  voidedEntriesCount: number
  auditEventsCount: number
  blockers: CloseoutIssue[]
  warnings: CloseoutIssue[]
  ready: boolean
}

export type CampaignFinalReport = {
  generatedAt: string
  campaign: AdminHostCampaign
  tournamentOutcomes: {
    tournament: Tournament | null
    teamsCount: number
    divisionsCount: number
    poolGamesCount: number
    playoffGamesCount: number
    otherGamesCount: number
    scoreCoverage: ScoreCoverage
    champions: TournamentChampion[]
  }
  finance: FinanceSummary
  compliance: {
    liveExpensesCount: number
    expensesMissingReceiptCount: number
    pendingReimbursementsCount: number
    openCashPledgesCount: number
    voidedEntriesCount: number
    auditEventsCount: number
    unfinalizedGamesCount: number
    championsRecordedCount: number
    readyToArchive: boolean
    blockers: CloseoutIssue[]
    warnings: CloseoutIssue[]
  }
}

export type CampaignClonePayload = {
  targetTournamentId?: string | null
  tournament?: {
    name: string
    year: number
    startDate: string
    endDate: string
    status?: TournamentStatus
  } | null
  classCohortId?: string | null
  hostClassYear?: number | null
  title?: string | null
  slug?: string | null
  goalCents?: number | null
  copyDivisions?: boolean
  copyBudgetCategories?: boolean
  copyBudgetAmounts?: boolean
  copyEventTemplates?: boolean
}

export type CampaignCloneResponse = {
  campaign: AdminHostCampaign
  tournament: Tournament
  divisions: Division[]
  budgetLinesCount: number
  campaignEventsCount: number
}

export type ReceiptPresignResponse = {
  uploadToken: string
  maxBytes: number
  expiresIn: number
  upload: {
    url: string
    fields: Record<string, string>
  }
}

export type SignedReceiptUrlResponse = {
  url: string
  expiresIn: number
  filename: string
  contentType: string
  byteSize: number | null
}

export type EffectiveCapability = {
  capability: string
  actions: string[]
  scopeType: string
  scopeIds: string[]
  allScopes: boolean
}

export type CurrentUser = {
  isSuperAdmin?: boolean
  capabilities?: EffectiveCapability[]
  allowedModules?: string[]
  defaultWorkspacePath?: string
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
  isScorekeeper?: boolean
  canScoreGames?: boolean
  campaignMemberships?: UserCampaignMembership[]
}

export type ApiErrorPayload = {
  error?: string
  errors?: string[] | Array<{ id?: string; errors: string[] }>
}

export type ScheduleImportRow = {
  rowIndex: number
  action: 'create' | 'update' | 'unchanged' | 'error'
  matchedGameId: string | null
  gameNumber: string | null
  bracketCode: string | null
  bracketRound: BracketRound | null
  bracketSlot: number | null
  phase: GamePhase
  startTime: string | null
  awayTeam: string | null
  awayTeamId: string | null
  homeTeam: string | null
  homeTeamId: string | null
  division: string | null
  divisionId: string | null
  venue: string | null
  notes: string | null
  status: GameStatus | null
  homeScore: number | null
  awayScore: number | null
  errors: string[]
  warnings: string[]
}

export type UnmatchedExistingGame = {
  id: string
  gameNumber: string | null
  startTime: string | null
  awayTeam: string | null
  homeTeam: string | null
  division: string | null
  phase: GamePhase
  status: GameStatus
  hasScores: boolean
}

export type ScheduleImportPreview = {
  tournamentId: string
  detectedFormat: string
  summary: {
    totalRows: number
    createCount: number
    updateCount: number
    unchangedCount: number
    errorCount: number
    newTeamsCount: number
    unmatchedExistingCount: number
    skippedLinesCount?: number
  }
  newTeams: Array<{ displayName: string; division: string | null; inferredClassKeys: string[] }>
  rows: ScheduleImportRow[]
  unmatchedExistingGames: UnmatchedExistingGame[]
  skippedLines?: Array<{ lineNumber: number; text: string }>
}

export type ScheduleImportCommitResult = {
  tournamentId: string
  createdTeams: number
  createdGames: number
  updatedGames: number
  unchangedGames: number
  recompute: { teams: number; games: number }
}

export type RosterImportRow = {
  rowIndex: number
  action: 'create' | 'update' | 'unchanged' | 'error'
  teamId: string | null
  team: string | null
  matchedEntryId: string | null
  name: string
  jerseyNumber: string | null
  position: string | null
  nickname: string | null
  errors: string[]
  warnings: string[]
}

export type RosterImportPreview = {
  tournamentId: string
  detectedFormat: string
  summary: {
    totalRows: number
    createCount: number
    updateCount: number
    unchangedCount: number
    errorCount: number
  }
  rows: RosterImportRow[]
}

export type RosterImportCommitResult = {
  tournamentId: string
  created: number
  updated: number
  unchanged: number
}

export type AuditEvent = {
  id: string
  occurredAt: string
  operationId: string
  actorType: 'user' | 'system' | 'anonymous'
  actorId: string | null
  actorName: string | null
  actorEmail: string | null
  actorRole: string | null
  area: string
  action: string
  recordType: string
  recordId: string
  recordLabel: string | null
  tournamentId: string | null
  hostCampaignId: string | null
  summary: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  metadata: Record<string, unknown>
  legacySource: string | null
  reason: string | null
  requestId: string | null
  httpMethod: string | null
  routePath: string | null
}

export type AdminAuditFilters = {
  q?: string
  area?: string
  action?: string
  actor_id?: string
  record_type?: string
  record_id?: string
  operation_id?: string
  tournament_id?: string
  host_campaign_id?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string | null
}

export type AuditFilterOption = { id: string; label: string }

export type AuditCheckpointSummary = {
  latestCheckpointId: string | null
  createdAt: string | null
  coveredEventCount: number
  uncheckpointedEventCount: number
}

export type AdminAuditResponse = {
  checkpointSummary?: AuditCheckpointSummary
  auditEvents: AuditEvent[]
  nextCursor: string | null
  filterOptions?: {
    areas: string[]
    actors: AuditFilterOption[]
    tournaments: AuditFilterOption[]
    campaigns: AuditFilterOption[]
  }
}

export type AdminAuditExportResponse = {
  auditEvents: AuditEvent[]
  latestCheckpoint: Record<string, unknown> | null
  truncated: boolean
}
