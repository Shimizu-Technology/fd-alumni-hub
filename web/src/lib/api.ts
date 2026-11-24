import type { AdminBoxScore, BoxScoreUpdate, LeaderMetric, LeaderScope, PublicBoxScore, StatLeadersResponse } from './boxScores'
import type { ScoreMutationPayload } from './scoreQueue'
import type { SiteMode, SiteModeAdmin, SiteModePreview, SiteModeSettings } from './siteMode'
import type { AccessDirectory, GrantScope, GrantSelection } from './access'
import type {
  AdminAuditExportResponse,
  AdminAuditFilters,
  AdminAuditResponse,
  AdminCampaignEvent,
  AdminCampaignPost,
  AdminHostCampaign,
  AdminUserSummary,
  AdminWhitelistRecord,
  Article,
  BudgetLineRecord,
  CampaignClonePayload,
  CampaignCloneResponse,
  CampaignCloseoutCheck,
  CampaignFinalReport,
  CampaignHandoffStatus,
  CampaignInvitationRecord,
  CampaignMembershipRecord,
  CampaignRole,
  ClassCohort,
  ClassProfile,
  CurrentUser,
  Division,
  DivisionStandingsGroup,
  FinanceAuditEvent,
  FinanceSummary,
  Game,
  AdminGamesResponse,
  BatchResultRow,
  SavedResult,
  ScoreCorrectionRequest,
  GameDayNote,
  TonightPayload,
  TournamentUpdate,
  InfoGuide,
  HomeHostCampaignSummary,
  HostYearResponse,
  FundraiserDetailResponse,
  IngestItem,
  LedgerEntryRecord,
  MediaAsset,
  PledgeRecord,
  PredictionPoll,
  PublicBracketResponse,
  PublicTicketsResponse,
  ReceiptPresignResponse,
  RosterEntry,
  RosterImportCommitResult,
  RosterImportPreview,
  RosterImportRow,
  ScheduleImportCommitResult,
  ScheduleImportPreview,
  ScheduleImportRow,
  ScoreCoverage,
  SignedReceiptUrlResponse,
  Sponsor,
  Standing,
  Team,
  TitleCount,
  Tournament,
  TournamentAlert,
  TournamentChampion,
  TournamentChampionPayload,
} from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '')

export type AdminImageUploadPresign = {
  uploadUrl: string
  fields: Record<string, string>
  key: string
  publicUrl: string
  maxBytes: number
  expiresIn: number
}

export type AdminImageUploadPresignPayload = {
  tournamentId: string
  filename: string
  contentType: string
  byteSize: number
  purpose?: string
}

type TokenGetter = () => Promise<string | null>
let tokenGetter: TokenGetter | null = null

export function setAuthTokenGetter(getter: TokenGetter | null) {
  tokenGetter = getter
}

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (tokenGetter) {
    const token = await tokenGetter()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(apiErrorMessage(payload, response.statusText || 'Request failed'), response.status, payload)
  }

  return payload as T
}

function apiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback

  const body = payload as { error?: unknown; errors?: unknown }
  if (typeof body.error === 'string' && body.error.trim()) return body.error

  if (Array.isArray(body.errors)) {
    const messages = body.errors.flatMap(errorEntryMessages)
    if (messages.length > 0) return messages.join(', ')
  }

  return fallback
}

function errorEntryMessages(entry: unknown): string[] {
  if (typeof entry === 'string') return [entry]
  if (!entry || typeof entry !== 'object') return []

  const item = entry as { id?: unknown; error?: unknown; errors?: unknown }
  const prefix = item.id === undefined || item.id === null ? '' : `Record ${item.id}: `

  if (typeof item.error === 'string') return [prefix + item.error]
  if (Array.isArray(item.errors)) {
    return item.errors.filter((message): message is string => typeof message === 'string').map((message) => prefix + message)
  }

  return []
}

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export const api = {
  adminAuditExport: (params: AdminAuditFilters = {}) =>
    request<AdminAuditExportResponse>(`/admin/audit_events/export${query(params)}`),
  adminAuditEvents: (params: AdminAuditFilters = {}, signal?: AbortSignal) =>
    request<AdminAuditResponse>(`/admin/audit_events${query(params)}`, { signal }),

  adminPermissionGrants: () => request<AccessDirectory>('/admin/permission_grants'),
  assignPermissionGrants: (payload: GrantScope & { presetKey?: string; grants: GrantSelection[] }) =>
    request('/admin/permission_grants/assign', json('POST', payload)),
  revokePermissionScope: (payload: GrantScope) => request('/admin/permission_grants/revoke_scope', json('POST', payload)),
  updateUserAccess: (id: string, payload: { superAdmin?: boolean; active?: boolean }) =>
    request(`/admin/users/${id}/access`, json('PATCH', payload)),
  getCurrentUser: () => request<{ user: CurrentUser }>('/me'),

  publicSiteMode: () => request<{ siteMode: SiteMode; alerts: TournamentAlert[] }>('/public/site-mode'),
  adminSiteMode: () => request<SiteModeAdmin>('/admin/site-mode'),
  previewSiteMode: (settings: SiteModeSettings, signal?: AbortSignal) =>
    request<SiteModePreview>('/admin/site-mode/preview', { ...json('POST', settings), signal }),
  publishSiteMode: (settings: SiteModeSettings) => request('/admin/site-mode/publish', json('POST', settings)),
  restoreSiteMode: (publicationId: string) => request('/admin/site-mode/restore', json('POST', { publicationId })),
  publicTeams: (params: { tournamentId?: string | null; year?: number | null; q?: string; division?: string } = {}) =>
    request<{ tournament: Tournament | null; teams: Team[]; divisions: string[]; schedulePublished: boolean }>(`/public/teams${query(params)}`),

  publicHome: (voterToken?: string | null) => request<{
    tournament: Tournament | null
    siteMode: SiteMode
    championRecords: TournamentChampion[]
    upcomingOrLiveTournament: Tournament | null
    latestResultsTournament: Tournament | null
    activeHostCampaign?: HomeHostCampaignSummary | null
    alerts?: TournamentAlert[]
    hostYear?: HostYearResponse
    schedulePreview?: Game[]
    todayGames: Game[]
    liveGames: Game[]
    latestNews: Article[]
    gameDayNote: GameDayNote | null
    predictionPolls: PredictionPoll[]
  }>('/public/home', voterToken ? { headers: { 'X-FD-Voter-Token': voterToken } } : {}),
  publicFundraiser: (id: string) =>
    request<FundraiserDetailResponse>(`/public/fundraisers/${encodeURIComponent(id)}`),
  publicHostYear: (params: { slug?: string | null; year?: number | null } = {}) =>
    request<HostYearResponse>(`/public/host-year${query(params)}`),
  publicToday: (params: { tournamentId?: string | null; year?: number | null; date?: string | null } = {}, voterToken?: string | null) =>
    request<TonightPayload>(`/public/today${query(params)}`, voterToken ? { headers: { 'X-FD-Voter-Token': voterToken } } : {}),
  publicInfo: (params: { tournamentId?: string; year?: string } = {}) =>
    request<{ tournament: Tournament; infoGuide: InfoGuide }>(`/public/info${query(params)}`),
  publicVotePrediction: (pollId: string, payload: { teamId: string; voterToken: string }) =>
    request<{ predictionPoll: PredictionPoll }>(`/public/prediction-polls/${pollId}/vote`, json('POST', { predictionVote: payload })),

  publicTournaments: () => request<{ tournaments: Tournament[]; activeTournament: Tournament | null }>('/public/tournaments'),
  publicChampions: (params: { year?: number | null } = {}) => request<{ championRecords: TournamentChampion[]; titleCounts: TitleCount[]; entryTitleCounts: TitleCount[] }>(`/public/champions${query(params)}`),
  publicClass: (classKey: string) => request<{ classProfile: ClassProfile; titleRecords: TournamentChampion[]; relatedTitleRecords: TournamentChampion[]; teams: Team[]; standings: Standing[]; games: Game[]; articles: Article[] }>(`/public/classes/${encodeURIComponent(classKey)}`),
  publicTeam: (id: string) => request<{ tournament: Tournament; team: Team; standing: Standing | null; games: Game[]; articles: Article[]; titleRecords: TournamentChampion[] }>(`/public/teams/${id}`),
  publicSchedule: (params: { tournamentId?: string | null; year?: number | null; division?: string | null; phase?: string | null; teamId?: string | null } = {}) =>
    request<{ tournament: Tournament | null; games: Game[]; teams: Team[]; divisions: string[]; phases: string[] }>(`/public/schedule${query(params)}`),
  publicGameBoxScore: (id: string) => request<PublicBoxScore>(`/public/games/${id}/box-score`),
  publicStatLeaders: (params: { tournamentId?: string; year?: number; division?: string; metric?: LeaderMetric; scope?: LeaderScope } = {}) =>
    request<StatLeadersResponse>(`/public/stat-leaders${query(params)}`),
  publicStandings: (params: { tournamentId?: string | null; year?: number | null; division?: string | null; divisionId?: string | null } = {}) =>
    request<{ tournament: Tournament | null; standings: Standing[]; divisions: string[]; divisionStandings?: DivisionStandingsGroup[]; scoreCoverage: ScoreCoverage }>(`/public/standings${query(params)}`),
  publicArticles: (params: { tournamentId?: string | null; year?: number | null; limit?: number; archive?: boolean } = {}) =>
    request<{ tournament: Tournament | null; articles: Article[] }>(`/public/articles${query(params)}`),
  publicMedia: (params: { tournamentId?: string | null; year?: number | null; limit?: number; archive?: boolean; mediaType?: 'photo' | 'video' } = {}) =>
    request<{ tournament: Tournament | null; mediaAssets: MediaAsset[] }>(`/public/media-assets${query(params)}`),
  publicSponsors: (params: { tournamentId?: string | null; year?: number | null } = {}) =>
    request<{ tournament: Tournament | null; sponsors: Sponsor[] }>(`/public/sponsors${query(params)}`),
  publicTickets: (params: { campaignSlug?: string | null; year?: number | null } = {}) =>
    request<PublicTicketsResponse>(`/public/tickets${query(params)}`),
  publicBracket: (params: { tournamentId?: string | null; year?: number | null; divisionId?: string | null } = {}) =>
    request<PublicBracketResponse>(`/public/bracket${query(params)}`),
  publicAlerts: (params: { tournamentId?: string | null; year?: number | null } = {}) =>
    request<{ tournamentId: string | null; alerts: TournamentAlert[] }>(`/public/alerts${query(params)}`),

  adminDashboard: () => request<{
    tournament: Tournament | null
    counts: Record<string, number>
    missing: { scores: number; streams: number; tickets: number }
    recentArticles: Article[]
  }>('/admin/dashboard'),
  adminTournaments: (capability?: string) => request<{ tournaments: Tournament[] }>(`/admin/tournaments${query({ capability })}`),
  adminTournament: (id: string) => request<{ tournament: Tournament }>(`/admin/tournaments/${id}`),
  adminCreateTournament: (payload: Partial<Tournament>) => request<{ tournament: Tournament }>('/admin/tournaments', json('POST', { tournament: payload })),
  adminSetupTournament: (payload: {
    tournament: { name: string; year: number; startDate: string; endDate: string; status?: string }
    divisions?: Array<{ name: string; position: number; countsForStandings: boolean; active?: boolean }>
    hostCampaign?: {
      title?: string
      slug?: string
      goalCents: number
      hostClassYear?: number
      classCohortId?: string
      fdaaUpfrontCents?: number
      fdaaTicketShareBps?: number
    } | null
  }) => request<{ tournament: Tournament; divisions: Division[]; hostCampaign: AdminHostCampaign | null }>('/admin/tournaments/setup', json('POST', payload)),
  adminUpdateTournament: (id: string, payload: Partial<Tournament>) => request<{ tournament: Tournament }>(`/admin/tournaments/${id}`, json('PATCH', { tournament: payload })),
  adminPreviewScheduleImport: (
    tournamentId: string,
    payload: { format?: string; content?: string; defaultVenue?: string; rows?: Array<Partial<ScheduleImportRow>> },
  ) => request<ScheduleImportPreview>(`/admin/tournaments/${tournamentId}/schedule-import/preview`, json('POST', payload)),
  adminCommitScheduleImport: (
    tournamentId: string,
    payload: { rows: Array<Partial<ScheduleImportRow>>; overwriteScores?: boolean; defaultVenue?: string },
  ) => request<ScheduleImportCommitResult>(`/admin/tournaments/${tournamentId}/schedule-import/commit`, json('POST', payload)),
  adminPreviewRosterImport: (
    tournamentId: string,
    payload: { format?: string; content?: string; rows?: Array<Partial<RosterImportRow>> },
  ) => request<RosterImportPreview>(`/admin/tournaments/${tournamentId}/roster-import/preview`, json('POST', payload)),
  adminCommitRosterImport: (
    tournamentId: string,
    payload: { rows: Array<Partial<RosterImportRow>> },
  ) => request<RosterImportCommitResult>(`/admin/tournaments/${tournamentId}/roster-import/commit`, json('POST', payload)),

  adminDivisions: (tournamentId?: string | null) => request<{ tournament?: Tournament | null; divisions: Division[]; allDivisions: Division[] }>(`/admin/divisions${query({ tournamentId })}`),
  adminCreateDivision: (payload: Partial<Division> & { tournamentId?: string | null }) => request<{ division: Division }>(`/admin/divisions${query({ tournamentId: payload.tournamentId })}`, json('POST', { division: payload })),
  adminUpdateDivision: (id: string, payload: Partial<Division>, tournamentId?: string | null) => request<{ division: Division }>(`/admin/divisions/${id}${query({ tournamentId })}`, json('PATCH', { division: payload })),
  adminClassCohorts: () => request<{ classCohorts: ClassCohort[] }>('/admin/class-cohorts'),

  adminTeams: (tournamentId?: string | null) => request<{ teams: Team[] }>(`/admin/teams${query({ tournamentId })}`),
  adminCreateTeam: (payload: Partial<Team> & { classCohortKeys?: string[] }) => request<{ team: Team }>(`/admin/teams${query({ tournamentId: payload.tournamentId })}`, json('POST', { team: payload })),
  adminUpdateTeam: (id: string, payload: Partial<Team> & { classCohortKeys?: string[]; classCohortKeysChanged?: boolean }, tournamentId?: string | null) => request<{ team: Team }>(`/admin/teams/${id}${query({ tournamentId })}`, json('PATCH', { team: payload })),
  adminDeleteTeam: (id: string, tournamentId?: string | null) => request<void>(`/admin/teams/${id}${query({ tournamentId })}`, { method: 'DELETE' }),
  adminCreateRosterEntry: (payload: Partial<RosterEntry>, tournamentId?: string | null) => request<{ rosterEntry: RosterEntry }>(`/admin/roster-entries${query({ tournamentId })}`, json('POST', { rosterEntry: payload })),
  adminBulkRosterEntries: (payload: Array<Partial<RosterEntry>>, tournamentId?: string | null) => request<{ created: number; rosterEntries: RosterEntry[] }>(`/admin/roster-entries/bulk${query({ tournamentId })}`, json('POST', { rosterEntries: payload })),
  adminUpdateRosterEntry: (id: string, payload: Partial<RosterEntry>, tournamentId?: string | null) => request<{ rosterEntry: RosterEntry }>(`/admin/roster-entries/${id}${query({ tournamentId })}`, json('PATCH', { rosterEntry: payload })),
  adminDeleteRosterEntry: (id: string, tournamentId?: string | null) => request<{ rosterEntry: RosterEntry; deactivated: true; message: string } | undefined>(`/admin/roster-entries/${id}${query({ tournamentId })}`, { method: 'DELETE' }),

  adminGameDay: (params: { tournamentId?: string | null; date?: string | null } = {}) => request<{
    tournament: Tournament
    date: string
    gameDayNote: GameDayNote | null
    games: Game[]
    predictionPolls: PredictionPoll[]
    infoGuide: InfoGuide
    scheduledDates?: string[]
  }>(`/admin/game-day-notes${query(params)}`),
  adminSaveGameDayNote: (payload: Partial<GameDayNote>) => request<{ gameDayNote: GameDayNote }>(`/admin/game-day-notes${query({ tournamentId: payload.tournamentId })}`, json('POST', { gameDayNote: payload })),
  adminPreviewNight: (tournamentId: string, date: string) =>
    request<TonightPayload>(`/admin/game-day-notes/preview${query({ tournamentId, date })}`),
  adminCopyPreviousMenu: (tournamentId: string, date: string, lockVersion?: number | null) =>
    request<{ gameDayNote: GameDayNote }>(`/admin/game-day-notes/copy-previous${query({ tournamentId, date })}`, json('POST', { lockVersion })),
  adminSaveInfoGuide: (tournamentId: string, infoGuide: InfoGuide) =>
    request<{ infoGuide: InfoGuide }>(`/admin/game-day-notes/info-guide${query({ tournamentId })}`, json('PATCH', { infoGuide })),
  adminTournamentUpdates: (tournamentId: string) =>
    request<{ updates: TournamentUpdate[] }>(`/admin/tournament-updates${query({ tournamentId })}`),
  adminSaveTournamentUpdate: (tournamentId: string, update: Partial<TournamentUpdate>) =>
    request<{ update: TournamentUpdate }>(`/admin/tournament-updates${update.id ? `/${update.id}` : ''}${query({ tournamentId })}`, json(update.id ? 'PATCH' : 'POST', { update })),
  adminDeleteTournamentUpdate: (id: string) =>
    request<void>(`/admin/tournament-updates/${id}`, { method: 'DELETE' }),
  adminAlerts: (tournamentId?: string | null) => request<{ alerts: TournamentAlert[] }>(`/admin/alerts${query({ tournamentId })}`),
  adminCreateAlert: (payload: Partial<TournamentAlert>) => request<{ alert: TournamentAlert }>('/admin/alerts', json('POST', { alert: payload })),
  adminUpdateAlert: (id: string, payload: Partial<TournamentAlert>) => request<{ alert: TournamentAlert }>(`/admin/alerts/${id}`, json('PATCH', { alert: payload })),
  adminDeleteAlert: (id: string) => request<void>(`/admin/alerts/${id}`, { method: 'DELETE' }),
  adminPredictionPolls: (tournamentId?: string | null) => request<{ tournament: Tournament; predictionPolls: PredictionPoll[] }>(`/admin/prediction-polls${query({ tournamentId })}`),
  adminCreatePredictionPoll: (payload: Partial<PredictionPoll>) => request<{ predictionPoll: PredictionPoll }>(`/admin/prediction-polls${query({ tournamentId: payload.tournamentId })}`, json('POST', { predictionPoll: payload })),
  adminUpdatePredictionPoll: (id: string, payload: Partial<PredictionPoll>, tournamentId?: string | null) => request<{ predictionPoll: PredictionPoll }>(`/admin/prediction-polls/${id}${query({ tournamentId })}`, json('PATCH', { predictionPoll: payload })),

  adminGameBoxScore: (id: string) => request<AdminBoxScore>(`/admin/games/${id}/box-score`),
  adminSaveGameBoxScore: (id: string, payload: BoxScoreUpdate) =>
    request<AdminBoxScore>(`/admin/games/${id}/box-score`, json('PUT', payload)),
  adminGames: (tournamentId?: string | null, filter?: { date?: string; unscoredOnly?: boolean }) => request<AdminGamesResponse>(`/admin/games${query({ tournamentId, date: filter?.date, unscoredOnly: filter?.unscoredOnly ? 'true' : undefined })}`),
  adminGame: (id: string) => request<{ game: Game }>(`/admin/games/${encodeURIComponent(id)}`),
  adminCreateGame: (payload: Partial<Game>) => request<{ game: Game }>('/admin/games', json('POST', { game: payload })),
  adminUpdateGame: (id: string, payload: Partial<Game & ScoreMutationPayload>) => request<SavedResult>(`/admin/games/${id}`, json('PATCH', { game: payload })),
  adminScoreGame: (id: string, payload: Partial<ScoreMutationPayload> & { clientMutationId?: string }) =>
    request<SavedResult>(`/admin/games/${id}/score`, json('PATCH', payload)),
  adminBatchResults: (results: (ScoreMutationPayload & { gameId: string; clientMutationId: string })[], tournamentId?: string) =>
    request<Omit<SavedResult, 'game'> & { results: BatchResultRow[] }>('/admin/games/batch-results', json('POST', { tournamentId, results })),
  adminScoreCorrectionRequests: (tournamentId: string, status: 'pending' | 'approved' | 'rejected' = 'pending') =>
    request<{ correctionRequests: ScoreCorrectionRequest[] }>(`/admin/score-correction-requests${query({ tournamentId, status })}`),
  adminRequestScoreCorrection: (id: string, payload: ScoreMutationPayload) =>
    request<{ correctionRequest: ScoreCorrectionRequest }>(`/admin/games/${id}/correction-requests`, json('POST', payload)),
  adminResolveScoreCorrection: (id: string, resolution: 'approve' | 'reject', resolutionNote?: string) =>
    request<Partial<SavedResult> & { correctionRequest: ScoreCorrectionRequest }>(`/admin/score-correction-requests/${id}/${resolution}`, json('POST', { resolutionNote })),
  adminResolveBracketReview: (id: string, note?: string) =>
    request<{ game: Game }>(`/admin/games/${id}/resolve-bracket-review`, json('PATCH', { note })),

  adminStandings: (tournamentId?: string | null) => request<{ tournament: Tournament | null; standings: Standing[]; divisionStandings?: DivisionStandingsGroup[]; scoreCoverage: ScoreCoverage }>(`/admin/standings${query({ tournamentId })}`),
  adminRecomputeStandings: (tournamentId?: string | null) => request<{ tournament: Tournament; recompute: { teams: number; games: number }; standings: Standing[]; divisionStandings?: DivisionStandingsGroup[]; scoreCoverage: ScoreCoverage }>(`/admin/standings/recompute${query({ tournamentId })}`, json('POST')),

  adminArticles: (tournamentId?: string | null) => request<{ articles: Article[] }>(`/admin/articles${query({ tournamentId })}`),
  adminCreateArticle: (payload: Partial<Article>) => request<{ article: Article }>('/admin/articles', json('POST', { article: payload })),
  adminUpdateArticle: (id: string, payload: Partial<Article>) => request<{ article: Article }>(`/admin/articles/${id}`, json('PATCH', { article: payload })),
  adminDeleteArticle: (id: string) => request<void>(`/admin/articles/${id}`, { method: 'DELETE' }),

  adminMedia: (tournamentId?: string | null) => request<{ mediaAssets: MediaAsset[] }>(`/admin/media-assets${query({ tournamentId })}`),
  adminCreateMedia: (payload: Partial<MediaAsset>) => request<{ mediaAsset: MediaAsset }>('/admin/media-assets', json('POST', { mediaAsset: payload })),
  adminUpdateMedia: (id: string, payload: Partial<MediaAsset>) => request<{ mediaAsset: MediaAsset }>(`/admin/media-assets/${id}`, json('PATCH', { mediaAsset: payload })),
  adminDeleteMedia: (id: string) => request<void>(`/admin/media-assets/${id}`, { method: 'DELETE' }),

  adminSponsors: (tournamentId?: string | null) => request<{ sponsors: Sponsor[] }>(`/admin/sponsors${query({ tournamentId })}`),
  adminPresignImageUpload: (payload: AdminImageUploadPresignPayload, signal?: AbortSignal) =>
    request<AdminImageUploadPresign>('/admin/uploads/presign', { ...json('POST', { upload: payload }), signal }),
  adminCreateSponsor: (payload: Partial<Sponsor>) => request<{ sponsor: Sponsor }>('/admin/sponsors', json('POST', { sponsor: payload })),
  adminUpdateSponsor: (id: string, payload: Partial<Sponsor>) => request<{ sponsor: Sponsor }>(`/admin/sponsors/${id}`, json('PATCH', { sponsor: payload })),
  adminDeleteSponsor: (id: string) => request<void>(`/admin/sponsors/${id}`, { method: 'DELETE' }),

  adminIngest: (params: { tournamentId?: string | null; status?: string | null } = {}) => request<{ ingestItems: IngestItem[] }>(`/admin/content-ingest-items${query(params)}`),
  adminCreateIngest: (payload: Partial<IngestItem>) => request<{ ingestItem: IngestItem }>('/admin/content-ingest-items', json('POST', { ingestItem: payload })),
  adminUpdateIngest: (id: string, payload: Partial<IngestItem>) => request<{ ingestItem: IngestItem }>(`/admin/content-ingest-items/${id}`, json('PATCH', { ingestItem: payload })),
  adminApproveIngest: (id: string) => request<{ ingestItem: IngestItem; imported: Article | MediaAsset }>(`/admin/content-ingest-items/${id}/approve`, json('POST')),
  adminRejectIngest: (id: string) => request<{ ingestItem: IngestItem }>(`/admin/content-ingest-items/${id}/reject`, json('POST')),
  adminDeleteIngest: (id: string) => request<void>(`/admin/content-ingest-items/${id}`, { method: 'DELETE' }),

  adminLinks: (tournamentId?: string | null) => request<{ tournament: Tournament | null; games: Game[] }>(`/admin/links${query({ tournamentId })}`),
  adminMissingLinks: (tournamentId?: string | null) => request<{
    tournament: Tournament | null
    summary: { missingTickets: number; missingStreams: number; missingScores: number }
    missingTickets: Game[]
    missingStreams: Game[]
    missingScores: Game[]
  }>(`/admin/missing-links${query({ tournamentId })}`),
  adminBulkLinks: (updates: Array<{ id: string; ticketUrl?: string | null; streamUrl?: string | null; lockVersion?: number }>) =>
    request<{ updated: number; games: Game[] }>('/admin/links/bulk', json('PATCH', { updates })),

  campaignSettings: (campaignSlug: string) =>
    request<{ campaign: AdminHostCampaign; roles: string[]; canManageDonationLinks?: boolean }>(`/campaign/${encodeURIComponent(campaignSlug)}/settings`),
  campaignUpdateSettings: (campaignSlug: string, payload: Record<string, unknown>) =>
    request<{ campaign: AdminHostCampaign }>(`/campaign/${encodeURIComponent(campaignSlug)}/settings`, json('PATCH', { campaign: payload })),
  campaignPresignImageUpload: (campaignSlug: string, payload: { filename: string; contentType: string; byteSize: number }) =>
    request<AdminImageUploadPresign>(`/campaign/${encodeURIComponent(campaignSlug)}/uploads/presign`, json('POST', { upload: payload })),
  campaignEvents: (campaignSlug: string, params: { includeArchived?: boolean } = {}) =>
    request<{ events: AdminCampaignEvent[] }>(`/campaign/${encodeURIComponent(campaignSlug)}/events${params.includeArchived ? '?includeArchived=true' : ''}`),
  campaignCreateEvent: (campaignSlug: string, payload: Record<string, unknown>) =>
    request<{ event: AdminCampaignEvent }>(`/campaign/${encodeURIComponent(campaignSlug)}/events`, json('POST', { event: payload })),
  campaignUpdateEvent: (campaignSlug: string, eventId: string, payload: Record<string, unknown>) =>
    request<{ event: AdminCampaignEvent }>(`/campaign/${encodeURIComponent(campaignSlug)}/events/${eventId}`, json('PATCH', { event: payload })),
  campaignArchiveEvent: (campaignSlug: string, eventId: string) =>
    request<{ event: AdminCampaignEvent }>(`/campaign/${encodeURIComponent(campaignSlug)}/events/${eventId}/archive`, json('POST')),
  campaignPosts: (campaignSlug: string) =>
    request<{ posts: AdminCampaignPost[] }>(`/campaign/${encodeURIComponent(campaignSlug)}/posts`),
  campaignCreatePost: (campaignSlug: string, payload: Record<string, unknown>) =>
    request<{ post: AdminCampaignPost }>(`/campaign/${encodeURIComponent(campaignSlug)}/posts`, json('POST', { post: payload })),
  campaignUpdatePost: (campaignSlug: string, postId: string, payload: Record<string, unknown>) =>
    request<{ post: AdminCampaignPost }>(`/campaign/${encodeURIComponent(campaignSlug)}/posts/${postId}`, json('PATCH', { post: payload })),
  campaignDeletePost: (campaignSlug: string, postId: string) =>
    request<void>(`/campaign/${encodeURIComponent(campaignSlug)}/posts/${postId}`, { method: 'DELETE' }),

  adminCampaigns: () => request<{ campaigns: AdminHostCampaign[] }>('/admin/campaigns'),
  adminCampaignWorkspace: (capability: string) =>
    request<{ campaigns: Pick<AdminHostCampaign, 'id' | 'slug' | 'title' | 'status'>[] }>(`/admin/campaigns${query({ capability })}`),
  adminCampaign: (id: string) => request<{ campaign: AdminHostCampaign }>(`/admin/campaigns/${id}`),
  adminCreateCampaign: (payload: Record<string, unknown>) =>
    request<{ campaign: AdminHostCampaign }>('/admin/campaigns', json('POST', { campaign: payload })),
  adminUpdateCampaign: (id: string, payload: Record<string, unknown>, breakGlassReason?: string | null) =>
    request<{ campaign: AdminHostCampaign }>(
      `/admin/campaigns/${id}`,
      json('PATCH', breakGlassReason ? { campaign: payload, breakGlassReason } : { campaign: payload }),
    ),
  adminCampaignHandoffStatus: (id: string) =>
    request<CampaignHandoffStatus>(`/admin/campaigns/${id}/handoff-status`),
  adminTournamentChampions: (tournamentId: string) =>
    request<{ champions: TournamentChampion[] }>(`/admin/tournaments/${tournamentId}/champions`),
  adminChampionTeamOptions: (tournamentId: string) =>
    request<{ teams: string[] }>(`/admin/tournaments/${tournamentId}/champions/team-options`),
  adminCreateTournamentChampion: (tournamentId: string, champion: TournamentChampionPayload) =>
    request<{ champion: TournamentChampion }>(`/admin/tournaments/${tournamentId}/champions`, json('POST', { champion })),
  adminUpdateTournamentChampion: (tournamentId: string, id: string, champion: TournamentChampionPayload) =>
    request<{ champion: TournamentChampion }>(`/admin/tournaments/${tournamentId}/champions/${id}`, json('PATCH', { champion })),
  adminDeleteTournamentChampion: (tournamentId: string, id: string) =>
    request<void>(`/admin/tournaments/${tournamentId}/champions/${id}`, json('DELETE')),
  adminCampaignCloseoutCheck: (id: string) =>
    request<CampaignCloseoutCheck>(`/admin/campaigns/${id}/closeout-check`),
  adminArchiveCampaign: (id: string, payload: { forceReason?: string | null; completeTournament?: boolean } = {}) =>
    request<{ campaign: AdminHostCampaign; tournament: Tournament | null; closeoutCheck: CampaignCloseoutCheck }>(
      `/admin/campaigns/${id}/archive`,
      json('POST', payload),
    ),
  adminCloneCampaign: (id: string, payload: CampaignClonePayload) =>
    request<CampaignCloneResponse>(`/admin/campaigns/${id}/clone`, json('POST', payload)),
  adminCampaignMemberships: (campaignId: string) =>
    request<{ memberships: CampaignMembershipRecord[]; users: AdminUserSummary[] }>(`/admin/campaigns/${campaignId}/memberships`),
  adminCreateCampaignMembership: (campaignId: string, payload: { userId: string; role: CampaignRole }) =>
    request<{ membership: CampaignMembershipRecord }>(`/admin/campaigns/${campaignId}/memberships`, json('POST', { membership: payload })),
  adminUpdateCampaignMembership: (campaignId: string, id: string, payload: { active: boolean }) =>
    request<{ membership: CampaignMembershipRecord }>(`/admin/campaigns/${campaignId}/memberships/${id}`, json('PATCH', { membership: payload })),
  adminCampaignInvitations: (campaignId: string) =>
    request<{ invitations: CampaignInvitationRecord[] }>(`/admin/campaigns/${campaignId}/invitations`),
  adminCreateCampaignInvitation: (campaignId: string, payload: { email: string; role: CampaignRole }) =>
    request<{ invitation: CampaignInvitationRecord }>(`/admin/campaigns/${campaignId}/invitations`, json('POST', { invitation: payload })),
  adminRevokeCampaignInvitation: (campaignId: string, id: string) =>
    request<{ invitation: CampaignInvitationRecord }>(`/admin/campaigns/${campaignId}/invitations/${id}/revoke`, json('POST')),
  adminWhitelists: () => request<{ whitelists: AdminWhitelistRecord[] }>('/admin/whitelists'),
  adminCreateWhitelist: (payload: { email: string; role: 'admin' | 'staff' | 'scorekeeper' | 'viewer'; notes?: string | null; active?: boolean }) =>
    request<{ whitelist: AdminWhitelistRecord }>('/admin/whitelists', json('POST', { whitelist: payload })),
  adminUpdateWhitelist: (id: string, payload: { role?: 'admin' | 'staff' | 'scorekeeper' | 'viewer'; active?: boolean; notes?: string | null }) =>
    request<{ whitelist: AdminWhitelistRecord }>(`/admin/whitelists/${id}`, json('PATCH', { whitelist: payload })),

  campaignFinanceSummary: (campaignSlug: string) =>
    request<{ campaign: AdminHostCampaign; roles: string[]; summary: FinanceSummary }>(`/campaign/${encodeURIComponent(campaignSlug)}/finance/summary`),
  campaignFinalReport: (campaignSlug: string) =>
    request<CampaignFinalReport>(`/campaign/${encodeURIComponent(campaignSlug)}/finance/final-report`),
  campaignFinanceAuditEvents: (campaignSlug: string, limit = 100) =>
    request<{ auditEvents: FinanceAuditEvent[] }>(`/campaign/${encodeURIComponent(campaignSlug)}/finance/audit-events?limit=${limit}`),
  campaignBudgetLines: (campaignSlug: string, params: { includeArchived?: boolean } = {}) =>
    request<{ budgetLines: BudgetLineRecord[] }>(`/campaign/${encodeURIComponent(campaignSlug)}/budget-lines${params.includeArchived ? '?includeArchived=true' : ''}`),
  campaignCreateBudgetLine: (campaignSlug: string, payload: Record<string, unknown>) =>
    request<{ budgetLine: BudgetLineRecord }>(`/campaign/${encodeURIComponent(campaignSlug)}/budget-lines`, json('POST', { budgetLine: payload })),
  campaignUpdateBudgetLine: (campaignSlug: string, id: string, payload: Record<string, unknown>) =>
    request<{ budgetLine: BudgetLineRecord }>(`/campaign/${encodeURIComponent(campaignSlug)}/budget-lines/${id}`, json('PATCH', { budgetLine: payload })),
  campaignArchiveBudgetLine: (campaignSlug: string, id: string) =>
    request<{ budgetLine: BudgetLineRecord }>(`/campaign/${encodeURIComponent(campaignSlug)}/budget-lines/${id}/archive`, json('POST')),
  campaignPledges: (campaignSlug: string) =>
    request<{ pledges: PledgeRecord[]; sponsors: Array<{ id: string; name: string }> }>(`/campaign/${encodeURIComponent(campaignSlug)}/pledges`),
  campaignCreatePledge: (campaignSlug: string, payload: Record<string, unknown>) =>
    request<{ pledge: PledgeRecord }>(`/campaign/${encodeURIComponent(campaignSlug)}/pledges`, json('POST', { pledge: payload })),
  campaignUpdatePledge: (campaignSlug: string, id: string, payload: Record<string, unknown>) =>
    request<{ pledge: PledgeRecord }>(`/campaign/${encodeURIComponent(campaignSlug)}/pledges/${id}`, json('PATCH', { pledge: payload })),
  campaignLedgerEntries: (
    campaignSlug: string,
    params: { entryType?: string; includeVoided?: boolean; reimbursementStatus?: string } = {},
  ) =>
    request<{
      ledgerEntries: LedgerEntryRecord[]
      options: {
        budgetLines: Array<{ id: string; kind: 'income' | 'expense'; category: string }>
        events: Array<{ id: string; title: string }>
        pledges: Array<{ id: string; donorName: string; status: string }>
        sponsors: Array<{ id: string; name: string }>
        members: Array<{ id: string; fullName: string; email: string }>
      }
    }>(`/campaign/${encodeURIComponent(campaignSlug)}/ledger-entries${query({
      entryType: params.entryType || undefined,
      includeVoided: params.includeVoided ? 'true' : undefined,
      reimbursementStatus: params.reimbursementStatus || undefined,
    })}`),
  campaignCreateLedgerEntry: (campaignSlug: string, payload: Record<string, unknown>) =>
    request<{ ledgerEntry: LedgerEntryRecord }>(`/campaign/${encodeURIComponent(campaignSlug)}/ledger-entries`, json('POST', { ledgerEntry: payload })),
  campaignUpdateLedgerEntry: (campaignSlug: string, id: string, payload: Record<string, unknown>) =>
    request<{ ledgerEntry: LedgerEntryRecord }>(`/campaign/${encodeURIComponent(campaignSlug)}/ledger-entries/${id}`, json('PATCH', { ledgerEntry: payload })),
  campaignVoidLedgerEntry: (campaignSlug: string, id: string, voidReason: string) =>
    request<{ ledgerEntry: LedgerEntryRecord }>(`/campaign/${encodeURIComponent(campaignSlug)}/ledger-entries/${id}/void`, json('POST', { voidReason })),
  campaignApproveReimbursement: (campaignSlug: string, id: string, overrideReason?: string) =>
    request<{ ledgerEntry: LedgerEntryRecord }>(
      `/campaign/${encodeURIComponent(campaignSlug)}/ledger-entries/${id}/approve-reimbursement`,
      json('POST', overrideReason ? { overrideReason } : {}),
    ),
  campaignMarkReimbursed: (campaignSlug: string, id: string, payload: { reimbursedAt?: string; reimbursementReference?: string }) =>
    request<{ ledgerEntry: LedgerEntryRecord }>(`/campaign/${encodeURIComponent(campaignSlug)}/ledger-entries/${id}/mark-reimbursed`, json('POST', payload)),
  campaignPresignReceipt: (campaignSlug: string, payload: { filename: string; contentType: string; byteSize: number }) =>
    request<ReceiptPresignResponse>(`/campaign/${encodeURIComponent(campaignSlug)}/receipts/presign`, json('POST', { upload: payload })),
  campaignReceiptUrl: (campaignSlug: string, entryId: string) =>
    request<SignedReceiptUrlResponse>(`/campaign/${encodeURIComponent(campaignSlug)}/ledger-entries/${entryId}/receipt-url`),
  campaignDownloadLedgerCsv: async (campaignSlug: string) => {
    const headers = new Headers({ Accept: 'text/csv' })
    if (tokenGetter) {
      const token = await tokenGetter()
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }
    const response = await fetch(`${API_BASE_URL}/campaign/${encodeURIComponent(campaignSlug)}/ledger-entries/export.csv`, {
      method: 'GET',
      headers,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let payload: unknown = null
      try { payload = text ? JSON.parse(text) : null } catch { payload = null }
      throw new ApiError(apiErrorMessage(payload, `CSV export failed (${response.status})`), response.status, payload)
    }
    return response.blob()
  },
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}
