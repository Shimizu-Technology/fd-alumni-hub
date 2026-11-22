import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { offlineSiteMode, type SiteModeName } from '../../lib/siteMode'
import { HomePage } from './HomePage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const tournament = { id: '1', name: 'Alumni Tournament', year: 2090, startDate: '2090-07-01', endDate: '2090-07-20', status: 'upcoming' } as const
const cases: [SiteModeName, string, string, number][] = [
  ['fundraising', 'FD Alumni Basketball', '/host-year', 2],
  ['schedule_ready', '2090 Tournament Schedule', '/schedule', 3],
  ['tournament_live', 'Tonight at The Jungle', '/today', 3],
  ['tournament_recap', '2090 Tournament Recap', '/history/2090', 2],
]

describe('HomePage', () => {
  it.each(cases)('uses focused calls to action in %s mode', async (mode, heading, primary, count) => {
    vi.spyOn(api, 'publicHome').mockResolvedValue({
      siteMode: { ...offlineSiteMode, tournament, mode }, tournament, championRecords: [],
      upcomingOrLiveTournament: tournament, latestResultsTournament: null,
      todayGames: [], liveGames: [], latestNews: [], gameDayNote: null, predictionPolls: [],
    })
    render(<MemoryRouter><HomePage /></MemoryRouter>)

    await screen.findByRole('heading', { name: heading })
    const heroRegion = screen.getByRole('region', { name: 'Season overview' })
    const classLookup = screen.getByRole('region', { name: 'Find Your Class' })
    if (mode !== 'tournament_live') expect(heroRegion.nextElementSibling).toBe(classLookup)
    expect(screen.queryByRole('region', { name: 'The Jungle Scoreboard' })).not.toBeInTheDocument()
    const hero = within(heroRegion)
    const links = hero.getAllByRole('link')
    expect(links).toHaveLength(count)
    expect(links[0]).toHaveAttribute('href', primary)
    expect(links[0]).toHaveClass('primary')
    expect(links.filter((link) => link.classList.contains('primary'))).toHaveLength(1)
    expect(screen.queryByText('Games today')).not.toBeInTheDocument()
  })

  it('renders the live scoreboard in live-first deduplicated order and caps game-day rows at six', async () => {
    const makeGame = (id: string, status: 'live' | 'scheduled' | 'final', awayName: string, homeName: string) => ({
      id, tournamentId: '1', homeTeamId: `h-${id}`, awayTeamId: `a-${id}`,
      homeTeam: { id: `h-${id}`, divisionId: 'div-maroon', displayName: homeName, division: 'Maroon', classYearLabel: homeName, classCohorts: [] },
      awayTeam: { id: `a-${id}`, divisionId: 'div-maroon', displayName: awayName, division: 'Maroon', classYearLabel: awayName, classCohorts: [] },
      status, startTime: '2090-07-08T09:00:00Z', venue: 'FD Jungle',
      homeScore: status === 'scheduled' ? null : 50, awayScore: status === 'scheduled' ? null : 48,
      streamUrl: null, ticketUrl: null, notes: null, division: 'Maroon', bracketCode: null,
    })
    const liveOne = makeGame('g-live-1', 'live', 'Class 2006', 'Class 2017')
    const liveTwo = makeGame('g-live-2', 'live', 'Class 2008', 'Class 2010')
    const todayGames = [
      liveOne, // duplicate ID already present in liveGames
      makeGame('g-sched-1', 'scheduled', 'Class 2012', 'Class 2014'),
      makeGame('g-sched-2', 'scheduled', 'Class 2015', 'Class 2016'),
      makeGame('g-sched-3', 'scheduled', 'Class 2018', 'Class 2019'),
      makeGame('g-sched-4', 'scheduled', 'Class 2020', 'Class 2021'),
      makeGame('g-sched-5', 'scheduled', 'Class 2022', 'Class 2023'),
    ]

    vi.spyOn(api, 'publicHome').mockResolvedValue({
      siteMode: { ...offlineSiteMode, tournament, mode: 'tournament_live', sections: { ...offlineSiteMode.sections, tonight: true } },
      tournament, championRecords: [], upcomingOrLiveTournament: tournament, latestResultsTournament: null,
      liveGames: [liveOne, liveTwo], todayGames, latestNews: [], gameDayNote: null, predictionPolls: [],
    })

    render(<MemoryRouter><HomePage /></MemoryRouter>)
    const scoreboard = await screen.findByRole('region', { name: 'The Jungle Scoreboard' })
    const cards = within(scoreboard).getAllByRole('listitem')
    expect(cards).toHaveLength(7)
    expect(cards[0]).toHaveTextContent('LIVE')
    expect(cards[0]).toHaveTextContent('Class 2006')
    expect(cards[1]).toHaveTextContent('LIVE')
    expect(cards[1]).toHaveTextContent('Class 2008')
    expect(cards[6]).toHaveTextContent('Class 2022')

    const gameDayHeading = screen.getByRole('heading', { name: 'Game-day updates' })
    const gameDayPanel = gameDayHeading.closest('.panel') as HTMLElement
    expect(within(gameDayPanel).getAllByRole('link', { name: /at Class/ })).toHaveLength(6)
  })

  it('offers the static champions archive when the API is unreachable', async () => {
    vi.spyOn(api, 'publicHome').mockRejectedValue(new Error('Offline'))
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    await screen.findByRole('heading', { name: 'Recent champions' })
    expect(screen.getByRole('heading', { name: 'Class of 2017' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Full history' })).toHaveAttribute('href', '/history')
  })
})
