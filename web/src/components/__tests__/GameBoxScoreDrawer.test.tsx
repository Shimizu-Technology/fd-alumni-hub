import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import type { PublicBoxScore } from '../../lib/boxScores'
import type { Game } from '../../lib/types'
import { GameBoxScoreButton } from '../GameBoxScoreDrawer'

const game: Game = {
  id: '42', tournamentId: '5', homeTeamId: '10', awayTeamId: '11', startTime: '2031-07-03T18:00:00+10:00',
  status: 'final', homeScore: 20, awayScore: 15, division: 'Maroon', streamUrl: null, ticketUrl: null,
  venue: null, notes: null, bracketCode: null, hasPublishedBoxScore: true,
}

const box: PublicBoxScore = {
  game, coverage: 'selected_scorers', underReview: false, publishedAt: '2031-07-03T22:00:00+10:00',
  homeStats: [{ rosterEntryId: '78', teamId: '10', playerName: 'Jamie Santos', jerseyNumber: '7',
    points: 0, rebounds: null, assists: null, steals: null, blocks: null, threePointersMade: null, fouls: null, minutes: null }],
  awayStats: [],
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it.each([
  ['selected_scorers', 'Selected scorers', false],
  ['full_box_score', 'Full box score', true],
] as const)('shows %s coverage, preserves zero and handles cancel', async (coverage, label, underReview) => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
  const request = vi.spyOn(api, 'publicGameBoxScore').mockResolvedValue({ ...box, coverage, underReview })
  render(<GameBoxScoreButton game={game} />)
  const trigger = screen.getByRole('button', { name: 'Box Score' })
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(trigger)
  expect(await screen.findByText(label)).toBeVisible()
  expect(request).toHaveBeenCalledExactlyOnceWith('42')
  const dialog = screen.getByRole('dialog', { name: 'Box score' })
  expect(Boolean(within(dialog).queryByText('Under review'))).toBe(underReview)
  const table = within(dialog).getByRole('table', { name: 'Home · Home team' })
  expect(within(table).getByRole('rowheader', { name: '#7 Jamie Santos' })).toBeVisible()
  expect(within(table).getByRole('cell', { name: '0' })).toBeVisible()
  expect(within(table).getAllByRole('cell', { name: '—' })).toHaveLength(7)
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('omits the trigger for nonfinal games and games without a publication', () => {
  const { rerender } = render(<GameBoxScoreButton game={{ ...game, status: 'live' }} />)
  expect(screen.queryByRole('button', { name: 'Box Score' })).not.toBeInTheDocument()
  rerender(<GameBoxScoreButton game={{ ...game, hasPublishedBoxScore: false }} />)
  expect(screen.queryByRole('button', { name: 'Box Score' })).not.toBeInTheDocument()
})
