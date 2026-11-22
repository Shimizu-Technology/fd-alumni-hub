import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import type { StatLeadersResponse } from '../../lib/boxScores'
import type { Tournament } from '../../lib/types'
import { StandingsPage } from './StandingsPage'

const tournament: Tournament = {
  id: '5', year: 2031, name: 'FD Tournament', startDate: '2031-07-03', endDate: '2031-07-15',
  status: 'live', enablePlayerStats: true,
}
const scoreCoverage = { scoredGames: 5, totalGames: 5, percent: 100 }
const leaders: StatLeadersResponse = {
  tournament, enabled: true, metric: 'points', division: null, scope: 'all',
  totalFinalGames: 5, gamesWithBoxScores: 2, fullBoxScoreGames: 0, metricRecordedGames: 2, isPartialCoverage: true,
  coverageLabel: 'Partial coverage — based on 2 of 5 final games',
  leaders: [{ rank: 1, rosterEntryId: '78', playerName: 'Jamie Santos', jerseyNumber: '7', teamId: '10',
    teamName: 'Home alumni', division: 'Maroon', gamesRecorded: 2, total: 24, average: 12 }],
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('shows metric-specific coverage, games recorded and filters even when the standings table is empty', async () => {
  vi.spyOn(api, 'publicStandings').mockResolvedValue({ tournament, standings: [], divisions: ['Maroon'], scoreCoverage })
  const request = vi.spyOn(api, 'publicStatLeaders').mockImplementation(async (params) => params?.metric === 'rebounds'
    ? { ...leaders, metric: 'rebounds', metricRecordedGames: 0, coverageLabel: 'Partial coverage — based on 0 of 5 final games', leaders: [] }
    : leaders)

  render(<MemoryRouter><StandingsPage /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Stat Leaders' })).toBeVisible()
  expect(screen.getByText('Partial coverage — based on 2 of 5 final games')).toBeVisible()
  expect(screen.getByText('Selected scorers')).toBeVisible()
  expect(screen.getByRole('columnheader', { name: 'Games recorded' })).toBeVisible()
  expect(screen.getByRole('rowheader', { name: /Jamie Santos/ })).toBeVisible()
  expect(screen.getByRole('cell', { name: '24' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Rebounds' }))
  expect(await screen.findByText('Partial coverage — based on 0 of 5 final games')).toBeVisible()
  expect(screen.getByText('This stat has no recorded player lines in the selected games.')).toBeVisible()
  expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ tournamentId: '5', metric: 'rebounds' }))
})

it('does not request leaders when the feature is off', async () => {
  vi.spyOn(api, 'publicStandings').mockResolvedValue({ tournament: { ...tournament, enablePlayerStats: false },
    standings: [], divisions: [], scoreCoverage })
  const request = vi.spyOn(api, 'publicStatLeaders')
  render(<MemoryRouter><StandingsPage /></MemoryRouter>)
  expect(await screen.findByText('No standings yet')).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Stat Leaders' })).not.toBeInTheDocument()
  expect(request).not.toHaveBeenCalled()
})
