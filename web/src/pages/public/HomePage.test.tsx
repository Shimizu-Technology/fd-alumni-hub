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

  it('offers the static champions archive when the API is unreachable', async () => {
    vi.spyOn(api, 'publicHome').mockRejectedValue(new Error('Offline'))
    render(<MemoryRouter><HomePage /></MemoryRouter>)
    await screen.findByRole('heading', { name: 'Recent champions' })
    expect(screen.getByRole('heading', { name: 'Class of 2017' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Full history' })).toHaveAttribute('href', '/history')
  })
})
