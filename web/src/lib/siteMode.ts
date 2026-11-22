import type { HomeHostCampaignSummary, Tournament } from './types'

export const siteModes = {
  fundraising: 'Fundraising',
  schedule_ready: 'Schedule Ready',
  tournament_live: 'Tournament Live',
  tournament_recap: 'Tournament Recap',
} as const

export const sectionLabels = {
  fundraisers: 'Fundraisers', tonight: 'Tonight', schedule: 'Schedule', teams: 'Teams',
  standings: 'Standings', bracket: 'Bracket', tickets: 'Tickets', sponsors: 'Sponsors',
  coverage: 'Coverage', recap: 'Recap',
} as const

export type SiteModeName = keyof typeof siteModes
export type SiteSection = keyof typeof sectionLabels
export type SiteLink = { label: string; to: string }
export type SiteMode = {
  mode: SiteModeName
  versionNumber: number | null
  publishedAt: string | null
  publishedByName: string | null
  isPreview: boolean
  tournament: Tournament | null
  hostCampaign: Omit<HomeHostCampaignSummary, 'meter'> | null
  schedulePublished: boolean
  recap: { headline: string | null; summary: string | null; handoffBannerEnabled: boolean }
  sections: Record<SiteSection, boolean>
  navItems: SiteLink[]
  mobileBottomNav: (SiteLink | { label: string; to: null })[]
  readiness: Record<SiteModeName, string[]>
  suggestedMode: SiteModeName
}
export type SiteModeSettings = {
  mode: SiteModeName
  tournamentId: string | null
  hostCampaignId: string | null
  sectionOverrides: Partial<Record<SiteSection, 'auto' | 'show' | 'hide'>>
  publishSchedule: boolean
  recapHeadline: string
  recapSummary: string
  handoffBannerEnabled: boolean
}
export type SitePublication = Omit<SiteModeSettings, 'publishSchedule' | 'recapHeadline' | 'recapSummary'> & {
  id: string
  versionNumber: number
  publishedAt: string
  publishedByName: string | null
  restoredFromId: string | null
  recapHeadline: string | null
  recapSummary: string | null
}
export type SiteModeAdmin = {
  current: SitePublication | null
  siteMode: SiteMode
  history: SitePublication[]
  tournaments: (Tournament & { schedulePublished: boolean; gameCount: number })[]
  campaigns: { id: string; title: string; status: string; hostClass: string | null; slug: string }[]
  readiness: SiteMode['readiness']
  suggestedMode: SiteModeName
  actions: ('publish' | 'restore')[]
}
export type SiteModePreview = {
  previewSiteMode: SiteMode
  changes: { appearing: SiteSection[]; disappearing: SiteSection[] }
  warnings: string[]
}

const offlineLinks = [
  { label: 'Home', to: '/' }, { label: 'Fundraisers', to: '/host-year' }, { label: 'History', to: '/history' },
]

export const offlineSiteMode: SiteMode = {
  mode: 'fundraising', versionNumber: null, publishedAt: null, publishedByName: null, isPreview: false,
  tournament: null, hostCampaign: null, schedulePublished: false,
  recap: { headline: null, summary: null, handoffBannerEnabled: false },
  sections: {
    fundraisers: false, tonight: false, schedule: false, teams: false, standings: false,
    bracket: false, tickets: false, sponsors: false, coverage: false, recap: false,
  },
  navItems: offlineLinks, mobileBottomNav: [...offlineLinks, { label: 'More', to: null }],
  readiness: { fundraising: [], schedule_ready: [], tournament_live: [], tournament_recap: [] },
  suggestedMode: 'fundraising',
}
