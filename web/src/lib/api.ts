import type {
  Article,
  CurrentUser,
  Game,
  IngestItem,
  MediaAsset,
  ScoreCoverage,
  Sponsor,
  Standing,
  Team,
  Tournament,
} from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '')

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
    const message = payload?.error || payload?.errors?.join?.(', ') || response.statusText || 'Request failed'
    throw new ApiError(message, response.status, payload)
  }

  return payload as T
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

  publicHome: () => request<{
    tournament: Tournament | null
    upcomingOrLiveTournament: Tournament | null
    latestResultsTournament: Tournament | null
    todayGames: Game[]
    liveGames: Game[]
    latestNews: Article[]
  }>('/public/home'),

  publicTournaments: () => request<{ tournaments: Tournament[]; activeTournament: Tournament | null }>('/public/tournaments'),
  publicSchedule: (params: { tournamentId?: string | null; year?: number | null; division?: string | null; phase?: string | null } = {}) =>
    request<{ tournament: Tournament | null; games: Game[]; divisions: string[]; phases: string[] }>(`/public/schedule${query(params)}`),
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
  adminCreateTournament: (payload: Partial<Tournament>) => request<{ tournament: Tournament }>('/admin/tournaments', json('POST', { tournament: payload })),
  adminUpdateTournament: (id: string, payload: Partial<Tournament>) => request<{ tournament: Tournament }>(`/admin/tournaments/${id}`, json('PATCH', { tournament: payload })),

  adminTeams: (tournamentId?: string | null) => request<{ teams: Team[] }>(`/admin/teams${query({ tournamentId })}`),
  adminCreateTeam: (payload: Partial<Team>) => request<{ team: Team }>('/admin/teams', json('POST', { team: payload })),
  adminUpdateTeam: (id: string, payload: Partial<Team>) => request<{ team: Team }>(`/admin/teams/${id}`, json('PATCH', { team: payload })),

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
