import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import type { Game } from '../../lib/types'
import { LiveScoreboardStrip } from '../LiveScoreboardStrip'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const liveGame: Game = {
  id: 'live', tournamentId: '2026', homeTeamId: 'home', awayTeamId: 'away',
  status: 'live', startTime: '2026-07-08T09:00:00Z', venue: null, homeScore: 0, awayScore: 12,
  streamUrl: null, ticketUrl: null, notes: null, division: null, bracketCode: null,
}
const finalGame: Game = { ...liveGame, id: 'final', status: 'final', homeScore: 61, awayScore: 59 }
const scheduledGame: Game = { ...liveGame, id: 'scheduled', status: 'scheduled', homeScore: null, awayScore: null }

function scoreboard(games: Game[]) {
  return <MemoryRouter><LiveScoreboardStrip games={games} /></MemoryRouter>
}

function mockMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
}

it('shows statuses, Guam tip-off and game-day links', () => {
  render(scoreboard([liveGame, finalGame, scheduledGame]))
  expect(screen.getByText('LIVE')).toBeInTheDocument()
  expect(screen.getByText('FINAL')).toBeInTheDocument()
  expect(screen.getByText('7:00 PM')).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
  const nav = within(screen.getByRole('navigation', { name: 'Scoreboard links' }))
  expect(nav.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/today')
  expect(nav.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/tickets')
  expect(nav.getByRole('link', { name: 'Schedule' })).toHaveAttribute('href', '/schedule')
})

it('ticks only the changed team score across polling updates, even when games reorder', () => {
  mockMotion(false)
  const view = render(scoreboard([liveGame, finalGame]))
  expect(screen.getByText('0')).not.toHaveClass('broadcast-score-tick')

  const scored = { ...liveGame, homeScore: 2 }
  view.rerender(scoreboard([finalGame, scored]))
  const changedScore = screen.getByText('2')
  expect(changedScore).toHaveClass('broadcast-score-tick')
  expect(screen.getByText('12')).not.toHaveClass('broadcast-score-tick')
  expect(screen.getByText('61')).not.toHaveClass('broadcast-score-tick')
  view.rerender(scoreboard([finalGame, { ...scored }]))
  expect(screen.getByText('2')).toBe(changedScore)

  view.rerender(scoreboard([finalGame, { ...scored, awayScore: 15 }]))
  expect(screen.getByText('15')).toHaveClass('broadcast-score-tick')
  expect(screen.getByText('2')).toBe(changedScore)
})

it('updates immediately when reduced motion is requested', () => {
  mockMotion(true)
  const view = render(scoreboard([liveGame]))
  view.rerender(scoreboard([{ ...liveGame, awayScore: 15 }]))
  expect(screen.getByText('15')).not.toHaveClass('broadcast-score-tick')
})
