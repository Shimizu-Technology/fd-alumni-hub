import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { offlineSiteMode, type SiteModeName } from '../../lib/siteMode'
import { staticChampionRecords } from '../../lib/staticChampions'
import type { Game, HomeHostCampaignSummary } from '../../lib/types'
import { campaign, hostYear, tournament, upcomingEvent } from '../../test/fundraiserFixtures'
import { HomePage } from './HomePage'

afterEach(() => vi.restoreAllMocks())

const hostCampaign: HomeHostCampaignSummary = { ...campaign, nextEvent: upcomingEvent }

function mockHome(mode: SiteModeName, payload: Partial<Awaited<ReturnType<typeof api.publicHome>>> = {}) {
  return vi.spyOn(api, 'publicHome').mockResolvedValue({
    siteMode: { ...offlineSiteMode, tournament, mode, hostCampaign, sections: {
      ...offlineSiteMode.sections, fundraisers: true,
      schedule: mode === 'schedule_ready', teams: mode === 'schedule_ready', tickets: mode === 'schedule_ready',
      tonight: mode === 'tournament_live', recap: mode === 'tournament_recap',
    } },
    tournament, championRecords: [], upcomingOrLiveTournament: tournament, latestResultsTournament: null,
    todayGames: [], liveGames: [], latestNews: [], gameDayNote: null, predictionPolls: [],
    ...payload,
  })
}

function open() {
  render(<MemoryRouter><HomePage /></MemoryRouter>)
}

function makeGame(id: string, status: Game['status'], awayName: string, homeName: string): Game {
  return {
    id, tournamentId: '1', homeTeamId: `h-${id}`, awayTeamId: `a-${id}`,
    homeTeam: { id: `h-${id}`, divisionId: 'div-maroon', displayName: homeName, division: 'Maroon', classYearLabel: homeName, classCohorts: [] },
    awayTeam: { id: `a-${id}`, divisionId: 'div-maroon', displayName: awayName, division: 'Maroon', classYearLabel: awayName, classCohorts: [] },
    status, startTime: '2090-07-08T09:00:00Z', venue: 'FD Jungle',
    homeScore: status === 'scheduled' ? null : 50, awayScore: status === 'scheduled' ? null : 48,
    streamUrl: null, ticketUrl: null, notes: null, division: 'Maroon', bracketCode: null,
  }
}

it('renders the entire fundraising headquarters from the home request', async () => {
  const home = mockHome('fundraising', { hostYear })
  const standalone = vi.spyOn(api, 'publicHostYear')
  open()

  expect(await screen.findByRole('heading', { name: 'Alumni Host Year' })).toBeInTheDocument()
  expect(screen.getByText('Countdown to tip-off')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Raised $4,200 of $30,000' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Upcoming fundraisers & events' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Completed & past fundraisers' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Event details' })).toHaveAttribute('href', '/fundraisers/20')
  expect(screen.getByRole('link', { name: 'Buy tickets' })).toHaveAttribute('href', 'https://example.com/tickets')
  const recapCard = within(screen.getByRole('heading', { name: 'Alumni night' }).closest('article')!)
  expect(recapCard.getByText('Completed')).toBeInTheDocument()
  expect(recapCard.getByText('$4,200 raised')).toBeInTheDocument()
  expect(recapCard.getByRole('link', { name: 'View recap & photos' })).toHaveAttribute('href', '/fundraisers/21')
  expect(screen.getByRole('heading', { name: 'Alumni night' }).closest('article')?.querySelector('img')).toHaveAttribute('src', 'https://images.example.com/team.jpg')
  expect(screen.getByRole('heading', { name: 'Ways to donate & sponsor' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Class updates & recaps' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Host class update' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Find Your Class' })).toBeInTheDocument()
  expect(home).toHaveBeenCalledTimes(1)
  expect(standalone).not.toHaveBeenCalled()
})

it('leads with countdown and schedule in schedule-ready mode, with fundraising secondary', async () => {
  const game = makeGame('1', 'scheduled', 'Class 2017', 'Class 2018')
  mockHome('schedule_ready', { schedulePreview: [game] })
  open()

  const hero = within(await screen.findByRole('region', { name: 'Season overview' }))
  expect(hero.getByRole('heading', { name: '2090 Tournament Schedule' })).toBeInTheDocument()
  expect(hero.getByText(/days until tip-off/)).toBeInTheDocument()
  expect(hero.getByRole('link', { name: 'Teams & Rosters' })).toHaveAttribute('href', '/teams')
  expect(hero.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/tickets')
  expect(screen.getByRole('link', { name: /Class 2017 at Class 2018/ })).toHaveAttribute('href', '/schedule')
  expect(screen.getByRole('link', { name: 'Explore fundraisers' })).toHaveAttribute('href', '/host-year/alumni-host-year')
  expect(screen.queryByText('Raised $4,200 of $30,000')).toBeNull()
})

it('leads live mode with the deduplicated scoreboard and Tonight at The Jungle', async () => {
  const liveOne = makeGame('live-1', 'live', 'Class 2006', 'Class 2017')
  const liveTwo = makeGame('live-2', 'live', 'Class 2008', 'Class 2010')
  const todayGames = [liveOne, ...Array.from({ length: 6 }, (_, i) => makeGame(`scheduled-${i}`, 'scheduled', `Class ${2020 + i}`, 'Class 2016'))]
  mockHome('tournament_live', {
    liveGames: [liveOne, liveTwo], todayGames,
    gameDayNote: { id: 'note-1', tournamentId: '1', date: '2090-07-08', active: true,
      hostClass: null, foodMenu: null, announcement: null, sponsorShoutout: null,
      hostSpotlight: { hostClassLabel: 'Class of 2017' }, menuItems: [{ name: 'BBQ plates' }] },
    alerts: [{ id: 'alert-1', tournamentId: '1', severity: 'urgent', title: 'Parking update',
      message: 'Use the west lot.', active: true, startsAt: null, expiresAt: null }],
  })

  open()
  const scoreboard = await screen.findByRole('region', { name: 'The Jungle Scoreboard' })
  const cards = within(scoreboard).getAllByRole('listitem')
  expect(cards).toHaveLength(8)
  expect(cards[0]).toHaveTextContent('LIVE')
  expect(cards[0]).toHaveTextContent('Class 2006')
  expect(cards[1]).toHaveTextContent('Class 2008')
  const tonight = within(scoreboard.nextElementSibling as HTMLElement)
  expect(tonight.getByRole('heading', { name: 'Tonight at The Jungle' })).toBeInTheDocument()
  expect(tonight.getByRole('link', { name: /Tonight’s guide/ })).toHaveAttribute('href', '/today')
  expect(tonight.getByText('BBQ plates')).toBeInTheDocument()
  expect(tonight.getByText('Class of 2017')).toBeInTheDocument()
  expect(tonight.getByText('Use the west lot.')).toBeInTheDocument()
  expect(tonight.getAllByRole('link', { name: /at Class/ })).toHaveLength(6)
  expect(screen.getByRole('region', { name: 'Find Your Class' })).toBeInTheDocument()
  expect(screen.queryByText('Raised $4,200 of $30,000')).toBeNull()
})

it('shows recap champions, class search and the optional handoff banner', async () => {
  const record = staticChampionRecords().find((champion) => champion.championLabel)!
  const fetch = mockHome('tournament_recap', { championRecords: [record] })
  const payload = await api.publicHome()
  fetch.mockResolvedValue({ ...payload, siteMode: { ...payload.siteMode, recap: {
    headline: 'From tip-off to the trophy', summary: 'A season to remember.', handoffBannerEnabled: true,
  } } })
  open()
  expect(await screen.findByRole('heading', { name: 'From tip-off to the trophy' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Champions' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Find Your Class' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Meet the host class' })).toHaveAttribute('href', '/host-year/alumni-host-year')
  expect(screen.queryByRole('heading', { name: 'The Jungle Scoreboard' })).toBeNull()
})

it('offers the static champions archive when the API is unreachable', async () => {
  vi.spyOn(api, 'publicHome').mockRejectedValue(new Error('Offline'))
  open()
  await screen.findByRole('heading', { name: 'Recent champions' })
  expect(screen.getByRole('heading', { name: 'Class of 2017' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Full history' })).toHaveAttribute('href', '/history')
})
