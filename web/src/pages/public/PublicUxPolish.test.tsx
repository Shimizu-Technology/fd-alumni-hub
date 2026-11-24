import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { publicSourceLabel } from '../../lib/history'
import { offlineSiteMode } from '../../lib/siteMode'
import { SiteModeProvider } from '../../contexts/SiteModeContext'
import * as backendHook from '../../hooks/useBackendAvailability'
import { HostYearShowcase } from '../../components/HostYearShowcase'
import { ClassProfilePage } from './ClassProfilePage'
import { GalleryPage } from './GalleryPage'
import { HistoryDetailPage } from './HistoryDetailPage'
import { NewsPage } from './NewsPage'
import { SponsorsPage } from './SponsorsPage'
import { TicketsPage } from './TicketsPage'
import type { HostYearResponse, MediaAsset, PublicTicketFundraiserItem, TournamentChampion } from '../../lib/types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('publicSourceLabel', () => {
  it('strips internal WhatsApp confirmation notes and falls back cleanly', () => {
    expect(publicSourceLabel('GSPN / WhatsApp confirmation')).toBe('GSPN')
    expect(publicSourceLabel('WhatsApp confirmation')).toBe('FDAA archive')
    expect(publicSourceLabel('PostGuam')).toBe('PostGuam')
    expect(publicSourceLabel(null)).toBe('')
  })
})

describe('HostYearShowcase deduplication', () => {
  const baseHostYear: HostYearResponse = {
    campaign: {
      id: '1',
      slug: 'co2017-host-year',
      title: 'Class of 2017 Host Year',
      tagline: 'Road to 2027',
      description: 'Official campaign.',
      status: 'active',
      featured: true,
      countdownTargetAt: '2027-06-25T08:00:00Z',
      countdownLabel: 'Tip-off',
      heroImageUrl: null,
      donationUrl: null,
      donationInstructions: null,
      golfUrl: 'https://fd-golf.shimizu-technology.com',
      tournament: { id: '1', name: 'FD Alumni', year: 2027, startDate: '2027-06-25', endDate: '2027-07-16', status: 'upcoming' },
      hostClass: { id: '1', key: '17', routeKey: '17', graduationYear: 2017, displayName: 'Class of 2017', shortLabel: "'17" },
      meter: { enabled: true, goalCents: 3000000, raisedCents: 620500, percent: 20.7, goalReached: false, updatedAt: '2026-11-24T00:00:00Z' },
    },
    events: [
      {
        id: '10',
        title: 'Two Pints, One Purpose',
        kind: 'fundraiser',
        status: 'completed',
        startsAt: '2026-11-20T08:00:00Z',
        endsAt: null,
        dateLabel: 'Nov 20',
        venue: 'Antigu Brewery',
        description: 'Kickoff fundraiser.',
        imageUrl: 'https://cdn.example.com/flyer.jpg',
        recapNotes: 'Great turnout.',
        recapHighlights: null,
        raisedDisplay: '$6,205+ net raised',
        recapPhotos: [{ url: 'https://cdn.example.com/recap-only.jpg', caption: 'Crowd' }],
        externalUrl: null,
        ctaLabel: null,
        hafapassEventId: null,
        hafapassEventSlug: null,
        hafapassDistributionCode: null,
        position: 1,
        hafapass: null,
      },
    ],
    posts: [
      {
        id: 'p1',
        title: 'Duplicate flyer post',
        body: 'Recap text.',
        imageUrl: 'https://cdn.example.com/flyer.jpg',
        pinned: true,
        publishedAt: '2026-11-21T00:00:00Z',
        authorName: 'Board',
      },
      {
        id: 'p2',
        title: 'Distinct recap photo post',
        body: 'Crowd photo.',
        imageUrl: 'https://cdn.example.com/recap-only.jpg',
        pinned: false,
        publishedAt: '2026-11-22T00:00:00Z',
        authorName: 'Board',
      },
    ],
    hafapass: { available: false, stale: false, fetchedAt: null, allTicketsUrl: null, events: [] },
  }

  it('hides duplicate rendered event flyer in posts while keeping unrendered recap photo and hides empty donate box', () => {
    const { container } = render(
      <MemoryRouter>
        <HostYearShowcase data={baseHostYear} />
      </MemoryRouter>,
    )
    expect(container.querySelector('.host-donate-panel')).toBeNull()
    const postImages = Array.from(container.querySelectorAll('.host-post-media img')).map((el) => el.getAttribute('src'))
    expect(postImages).toEqual(['https://cdn.example.com/recap-only.jpg'])
  })
})

describe('Public UX polish pages', () => {
  it('renders partner tiers and Host Year CTA on SponsorsPage when empty', async () => {
    vi.spyOn(api, 'publicSponsors').mockResolvedValue({ tournament: null, sponsors: [] })
    render(<MemoryRouter><SponsorsPage /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: /Partner with the FD Alumni Tournament/i })).toBeInTheDocument()
    expect(screen.getByText('Title & Diamond')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View Host Year Hub/i })).toHaveAttribute('href', '/')
  })

  it('sorts underscore schedule graphics after action photos in GalleryPage', async () => {
    const assets: MediaAsset[] = [
      { id: '1', tournamentId: '1', gameId: null, title: '2027 tournament', source: 'FDAA', mediaType: 'photo', imageUrl: 'https://cdn.example.com/2027_schedule.png', articleUrl: null, caption: null, takenAt: null, tags: null, tagList: [] },
      { id: '2', tournamentId: '1', gameId: null, title: 'Maroon Championship Dunk', source: 'GSPN', mediaType: 'photo', imageUrl: 'https://cdn.example.com/dunk.jpg', articleUrl: null, caption: null, takenAt: null, tags: null, tagList: [] },
    ]
    vi.spyOn(api, 'publicMedia').mockResolvedValue({
      tournament: null,
      mediaAssets: assets,
    })
    render(<MemoryRouter><GalleryPage /></MemoryRouter>)
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['Maroon Championship Dunk', '2027 tournament'])
  })

  it('uses tournament year on TicketsPage and skips internal detail links for HåfaPass-only hp- items', async () => {
    vi.spyOn(backendHook, 'useBackendAvailabilityContext').mockReturnValue({
      status: 'available', isUnavailable: false, isChecking: false,
      retry: vi.fn(async () => {}), reportUnavailable: vi.fn(), reportAvailable: vi.fn(),
    })
    vi.spyOn(api, 'publicSiteMode').mockResolvedValue({ siteMode: offlineSiteMode, alerts: [] })
    vi.spyOn(api, 'publicTickets').mockResolvedValue({
      tournament: { id: '2026', name: 'FD Alumni', year: 2026, startDate: '2026-06-20', endDate: '2026-07-12', status: 'upcoming' },
      campaign: null,
      hafapass: { available: false, stale: false, fetchedAt: null },
      passes: [],
      gameNights: [],
      otherEvents: [],
      fundraiserEvents: [
        { id: '10', title: 'Past Night', kind: 'fundraiser', status: 'completed', startsAt: null, endsAt: null, dateLabel: 'Nov 1', venueName: 'Antigu', shortDescription: null, ticketState: null, minAllInPriceCents: null, ticketTypes: [], availabilityLabel: null, stale: false, buyUrl: null, ctaLabel: null },
        { id: 'hp-99', title: 'Hafapass Snapshot Event', kind: 'fundraiser', status: 'planned', startsAt: null, endsAt: null, dateLabel: 'Dec 1', venueName: 'Phoenix Center', shortDescription: null, ticketState: 'on_sale', minAllInPriceCents: 2000, ticketTypes: [], availabilityLabel: 'On sale', stale: false, buyUrl: 'https://hafapass.com/e/99', ctaLabel: 'Buy tickets' },
      ] satisfies PublicTicketFundraiserItem[],
      doorInfo: { venue: 'Phoenix Center', doorsOpenNote: '', paymentNote: '', reentryNote: '', tournamentYear: 2026 },
    })
    render(
      <MemoryRouter>
        <SiteModeProvider>
          <TicketsPage />
        </SiteModeProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: '2026 Fundraisers & Tournament Tickets' })).toBeInTheDocument()
    const cards = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(cards).toEqual(['Hafapass Snapshot Event', 'Past Night'])
    expect(screen.queryByRole('link', { name: /Event details/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View recap/i })).toHaveAttribute('href', '/fundraisers/10')
  })

  it('loads available archive years on NewsPage and fetches selected year articles', async () => {
    const spy = vi.spyOn(api, 'publicArticles')
      .mockResolvedValueOnce({
        tournament: null,
        availableYears: [2026, 2025],
        articles: [{ id: 'a1', tournamentId: '1', tournamentYear: 2026, gameId: null, title: '2026 Title Game', source: 'GSPN', url: 'https://example.com/2026', publishedAt: '2026-07-10T00:00:00Z', imageUrl: null, excerpt: null }],
      })
      .mockResolvedValueOnce({
        tournament: null,
        availableYears: [2026, 2025],
        articles: [{ id: 'a2', tournamentId: '2', tournamentYear: 2025, gameId: null, title: '2025 Recap', source: 'GSPN', url: 'https://example.com/2025', publishedAt: '2025-07-10T00:00:00Z', imageUrl: null, excerpt: null }],
      })
    render(<MemoryRouter><NewsPage /></MemoryRouter>)
    expect(await screen.findByText('2026 Title Game')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2025' }))
    expect(await screen.findByText('2025 Recap')).toBeInTheDocument()
    expect(spy).toHaveBeenLastCalledWith({ year: 2025, limit: 200 })
  })

  it('collapses unscored schedule slots only for completed tournament archives on HistoryDetailPage', async () => {
    const champion: TournamentChampion = {
      id: 'c1',
      tournamentId: 't1',
      year: 2026,
      editionLabel: '2026 Maroon',
      label: '2026 Maroon',
      bracket: 'maroon',
      championLabel: 'Class of 2016',
      championKey: '16',
      championComponents: ['16'],
      creditedClasses: [],
      runnerUpLabel: null,
      runnerUpKey: null,
      score: '70-65',
      source: 'GSPN / WhatsApp confirmation',
      sourceUrl: null,
      notes: null,
      status: 'completed',
      primary: true,
      position: 1,
    }
    vi.spyOn(api, 'publicChampions').mockResolvedValue({ championRecords: [champion], titleCounts: [], entryTitleCounts: [] })
    vi.spyOn(api, 'publicSchedule').mockResolvedValue({
      tournament: { id: 't1', name: 'FD Alumni', year: 2026, startDate: '2026-06-20', endDate: '2026-07-12', status: 'completed' },
      games: [
        { id: 'g1', tournamentId: 't1', homeTeamId: '1', awayTeamId: '2', startTime: '2026-07-12T08:00:00Z', venue: 'Phoenix Center', status: 'final', phase: 'playoff', bracketCode: null, homeScore: 70, awayScore: 65, streamUrl: null, ticketUrl: null, notes: null, division: 'Maroon' },
        { id: 'g2', tournamentId: 't1', homeTeamId: '1', awayTeamId: '2', startTime: '2026-06-25T08:00:00Z', venue: 'Phoenix Center', status: 'scheduled', phase: 'pool', bracketCode: null, homeScore: null, awayScore: null, streamUrl: null, ticketUrl: null, notes: null, division: 'Maroon' },
      ],
      teams: [], divisions: [], phases: [],
    })
    vi.spyOn(api, 'publicStandings').mockResolvedValue({ tournament: null, standings: [], divisions: [], scoreCoverage: { scoredGames: 1, totalGames: 2, percent: 50 } })
    vi.spyOn(api, 'publicArticles').mockResolvedValue({ tournament: null, articles: [] })
    vi.spyOn(api, 'publicMedia').mockResolvedValue({ tournament: null, mediaAssets: [] })
    vi.spyOn(api, 'publicSponsors').mockResolvedValue({ tournament: null, sponsors: [] })

    render(
      <MemoryRouter initialEntries={['/history/2026']}>
        <Routes><Route path="/history/:year" element={<HistoryDetailPage />} /></Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Show 1 archived schedule slot without recorded scores/i)).toBeInTheDocument()
    expect(screen.queryByText(/WhatsApp confirmation/i)).not.toBeInTheDocument()
  })

  it('omits duplicate combined-class panel on ClassProfilePage when solo titles already cover the records', async () => {
    const title: TournamentChampion = {
      id: 'c1',
      tournamentId: 't24',
      year: 2024,
      editionLabel: '2024 Maroon',
      label: '2024 Maroon',
      bracket: 'maroon',
      championLabel: 'Class of 2017',
      championKey: '17',
      championComponents: ['17'],
      creditedClasses: [],
      runnerUpLabel: 'Class of 2013',
      runnerUpKey: '13',
      score: null,
      source: 'GSPN / WhatsApp confirmation',
      sourceUrl: null,
      notes: null,
      status: 'completed',
      primary: true,
      position: 1,
    }
    vi.spyOn(api, 'publicClass').mockResolvedValue({
      classProfile: { classKey: '17', routeKey: '17', displayName: 'Class of 2017', titleCount: 1, titleYears: [2024], teamCount: 0, latestTournamentYear: null, componentClasses: [] },
      titleRecords: [title],
      relatedTitleRecords: [title],
      teams: [], standings: [], games: [], articles: [],
    })
    render(
      <MemoryRouter initialEntries={['/classes/17']}>
        <Routes><Route path="/classes/:classKey" element={<ClassProfilePage />} /></Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Title history' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Combined class context' })).not.toBeInTheDocument()
    expect(screen.queryByText(/WhatsApp confirmation/i)).not.toBeInTheDocument()
  })
})
