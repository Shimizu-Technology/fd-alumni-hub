import type {
  Article,
  ClassProfile,
  CurrentUser,
  Division,
  Game,
  GameDayNote,
  IngestItem,
  MediaAsset,
  PredictionPoll,
  RosterEntry,
  ScoreCoverage,
  Sponsor,
  Standing,
  Team,
  TitleCount,
  Tournament,
  TournamentChampion,
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

function query(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export const api = {
  getCurrentUser: () => request<{ user: CurrentUser }>('/me'),

  publicHome: (voterToken?: string | null) => request<{
    tournament: Tournament | null
    upcomingOrLiveTournament: Tournament | null
    latestResultsTournament: Tournament | null
    todayGames: Game[]
    liveGames: Game[]
    latestNews: Article[]
    gameDayNote: GameDayNote | null
    predictionPolls: PredictionPoll[]
  }>('/public/home', voterToken ? { headers: { 'X-FD-Voter-Token': voterToken } } : {}),
  publicToday: (params: { tournamentId?: string | null; year?: number | null; date?: string | null } = {}, voterToken?: string | null) =>
    request<{
      tournament: Tournament | null
      date: string
      gameDayNote: GameDayNote | null
      games: Game[]
      predictionPolls: PredictionPoll[]
      sponsors: Sponsor[]
      lastUpdatedAt: string | null
    }>(`/public/today${query(params)}`, voterToken ? { headers: { 'X-FD-Voter-Token': voterToken } } : {}),
  publicVotePrediction: (pollId: string, payload: { teamId: string; voterToken: string }) =>
    request<{ predictionPoll: PredictionPoll }>(`/public/prediction-polls/${pollId}/vote`, json('POST', { predictionVote: payload })),

  publicTournaments: () => request<{ tournaments: Tournament[]; activeTournament: Tournament | null }>('/public/tournaments'),
  publicChampions: (params: { year?: number | null } = {}) => request<{ championRecords: TournamentChampion[]; titleCounts: TitleCount[]; entryTitleCounts: TitleCount[] }>(`/public/champions${query(params)}`),
  publicClass: (classKey: string) => request<{ classProfile: ClassProfile; titleRecords: TournamentChampion[]; relatedTitleRecords: TournamentChampion[]; teams: Team[]; standings: Standing[]; games: Game[]; articles: Article[] }>(`/public/classes/${encodeURIComponent(classKey)}`),
  publicTeam: (id: string) => request<{ tournament: Tournament; team: Team; standing: Standing | null; games: Game[]; articles: Article[]; titleRecords: TournamentChampion[] }>(`/public/teams/${id}`),
  publicSchedule: (params: { tournamentId?: string | null; year?: number | null; division?: string | null; phase?: string | null; teamId?: string | null } = {}) =>
    request<{ tournament: Tournament | null; games: Game[]; teams: Team[]; divisions: string[]; phases: string[] }>(`/public/schedule${query(params)}`),
  publicStandings: (params: { tournamentId?: string | null; year?: number | null; division?: string | null } = {}) =>
    request<{ tournament: Tournament | null; standings: Standing[]; divisions: string[]; scoreCoverage: ScoreCoverage }>(`/public/standings${query(params)}`),
  publicArticles: (params: { tournamentId?: string | null; year?: number | null; limit?: number } = {}) =>
    request<{ tournament: Tournament | null; articles: Article[] }>(`/public/articles${query(params)}`),
  publicMedia: (params: { tournamentId?: string | null; year?: number | null; limit?: number } = {}) =>
    request<{ tournament: Tournament | null; mediaAssets: MediaAsset[] }>(`/public/media-assets${query(params)}`),
  publicSponsors: (params: { tournamentId?: string | null; year?: number | null } = {}) =>
    request<{ tournament: Tournament | null; sponsors: Sponsor[] }>(`/public/sponsors${query(params)}`),

  adminDashboard: () => request<{
    tournament: Tournament | null
    counts: Record<string, number>
    missing: { scores: number; streams: number; tickets: number }
    recentArticles: Article[]
  }>('/admin/dashboard'),
  adminTournaments: () => request<{ tournaments: Tournament[] }>('/admin/tournaments'),
  adminTournament: (id: string) => request<{ tournament: Tournament }>(`/admin/tournaments/${id}`),
  adminCreateTournament: (payload: Partial<Tournament>) => request<{ tournament: Tournament }>('/admin/tournaments', json('POST', { tournament: payload })),
  adminUpdateTournament: (id: string, payload: Partial<Tournament>) => request<{ tournament: Tournament }>(`/admin/tournaments/${id}`, json('PATCH', { tournament: payload })),

  adminDivisions: (tournamentId?: string | null) => request<{ divisions: Division[]; allDivisions: Division[] }>(`/admin/divisions${query({ tournamentId })}`),
  adminCreateDivision: (payload: Partial<Division> & { tournamentId?: string | null }) => request<{ division: Division }>(`/admin/divisions${query({ tournamentId: payload.tournamentId })}`, json('POST', { division: payload })),
  adminUpdateDivision: (id: string, payload: Partial<Division>) => request<{ division: Division }>(`/admin/divisions/${id}`, json('PATCH', { division: payload })),

  adminTeams: (tournamentId?: string | null) => request<{ teams: Team[] }>(`/admin/teams${query({ tournamentId })}`),
  adminCreateTeam: (payload: Partial<Team>) => request<{ team: Team }>(`/admin/teams${query({ tournamentId: payload.tournamentId })}`, json('POST', { team: payload })),
  adminUpdateTeam: (id: string, payload: Partial<Team>, tournamentId?: string | null) => request<{ team: Team }>(`/admin/teams/${id}${query({ tournamentId })}`, json('PATCH', { team: payload })),
  adminDeleteTeam: (id: string, tournamentId?: string | null) => request<void>(`/admin/teams/${id}${query({ tournamentId })}`, { method: 'DELETE' }),
  adminCreateRosterEntry: (payload: Partial<RosterEntry>, tournamentId?: string | null) => request<{ rosterEntry: RosterEntry }>(`/admin/roster-entries${query({ tournamentId })}`, json('POST', { rosterEntry: payload })),
  adminBulkRosterEntries: (payload: Array<Partial<RosterEntry>>, tournamentId?: string | null) => request<{ created: number; rosterEntries: RosterEntry[] }>(`/admin/roster-entries/bulk${query({ tournamentId })}`, json('POST', { rosterEntries: payload })),
  adminUpdateRosterEntry: (id: string, payload: Partial<RosterEntry>, tournamentId?: string | null) => request<{ rosterEntry: RosterEntry }>(`/admin/roster-entries/${id}${query({ tournamentId })}`, json('PATCH', { rosterEntry: payload })),
  adminDeleteRosterEntry: (id: string, tournamentId?: string | null) => request<void>(`/admin/roster-entries/${id}${query({ tournamentId })}`, { method: 'DELETE' }),

  adminGameDay: (params: { tournamentId?: string | null; date?: string | null } = {}) => request<{
    tournament: Tournament
    date: string
    gameDayNote: GameDayNote | null
    games: Game[]
    predictionPolls: PredictionPoll[]
  }>(`/admin/game-day-notes${query(params)}`),
  adminSaveGameDayNote: (payload: Partial<GameDayNote>) => request<{ gameDayNote: GameDayNote }>(`/admin/game-day-notes${query({ tournamentId: payload.tournamentId })}`, json('POST', { gameDayNote: payload })),
  adminPredictionPolls: (tournamentId?: string | null) => request<{ tournament: Tournament; predictionPolls: PredictionPoll[] }>(`/admin/prediction-polls${query({ tournamentId })}`),
  adminCreatePredictionPoll: (payload: Partial<PredictionPoll>) => request<{ predictionPoll: PredictionPoll }>(`/admin/prediction-polls${query({ tournamentId: payload.tournamentId })}`, json('POST', { predictionPoll: payload })),
  adminUpdatePredictionPoll: (id: string, payload: Partial<PredictionPoll>, tournamentId?: string | null) => request<{ predictionPoll: PredictionPoll }>(`/admin/prediction-polls/${id}${query({ tournamentId })}`, json('PATCH', { predictionPoll: payload })),

  adminGames: (tournamentId?: string | null) => request<{ games: Game[] }>(`/admin/games${query({ tournamentId })}`),
  adminCreateGame: (payload: Partial<Game>) => request<{ game: Game }>('/admin/games', json('POST', { game: payload })),
  adminUpdateGame: (id: string, payload: Partial<Game>) => request<{ game: Game; recompute?: { teams: number; games: number } }>(`/admin/games/${id}`, json('PATCH', { game: payload })),

  adminStandings: (tournamentId?: string | null) => request<{ tournament: Tournament | null; standings: Standing[]; scoreCoverage: ScoreCoverage }>(`/admin/standings${query({ tournamentId })}`),
  adminRecomputeStandings: (tournamentId?: string | null) => request<{ tournament: Tournament; recompute: { teams: number; games: number }; standings: Standing[]; scoreCoverage: ScoreCoverage }>(`/admin/standings/recompute${query({ tournamentId })}`, json('POST')),

  adminArticles: (tournamentId?: string | null) => request<{ articles: Article[] }>(`/admin/articles${query({ tournamentId })}`),
  adminCreateArticle: (payload: Partial<Article>) => request<{ article: Article }>('/admin/articles', json('POST', { article: payload })),
  adminUpdateArticle: (id: string, payload: Partial<Article>) => request<{ article: Article }>(`/admin/articles/${id}`, json('PATCH', { article: payload })),
  adminDeleteArticle: (id: string) => request<void>(`/admin/articles/${id}`, { method: 'DELETE' }),

  adminMedia: (tournamentId?: string | null) => request<{ mediaAssets: MediaAsset[] }>(`/admin/media-assets${query({ tournamentId })}`),
  adminCreateMedia: (payload: Partial<MediaAsset>) => request<{ mediaAsset: MediaAsset }>('/admin/media-assets', json('POST', { mediaAsset: payload })),
  adminUpdateMedia: (id: string, payload: Partial<MediaAsset>) => request<{ mediaAsset: MediaAsset }>(`/admin/media-assets/${id}`, json('PATCH', { mediaAsset: payload })),
  adminDeleteMedia: (id: string) => request<void>(`/admin/media-assets/${id}`, { method: 'DELETE' }),

  adminSponsors: (tournamentId?: string | null) => request<{ sponsors: Sponsor[] }>(`/admin/sponsors${query({ tournamentId })}`),
  adminPresignImageUpload: (payload: AdminImageUploadPresignPayload) => request<AdminImageUploadPresign>('/admin/uploads/presign', json('POST', { upload: payload })),
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
  adminBulkLinks: (updates: Array<{ id: string; ticketUrl?: string | null; streamUrl?: string | null }>) =>
    request<{ updated: number; games: Game[] }>('/admin/links/bulk', json('PATCH', { updates })),
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}
