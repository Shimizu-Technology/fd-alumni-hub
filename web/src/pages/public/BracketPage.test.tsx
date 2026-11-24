import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import type { Game } from '../../lib/types'
import { BracketPage } from './BracketPage'

const game: Game = {
  id: 'q1', tournamentId: '1', homeTeamId: '1', awayTeamId: '2', startTime: '2027-07-12T09:00:00Z',
  status: 'scheduled', homeScore: null, awayScore: null, streamUrl: null, ticketUrl: null, notes: null,
  bracketCode: 'MQF1', division: 'Maroon', venue: null,
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it.each([false, true])('renders a single bracket layout when matchMedia matches %s', async (mobile) => {
  const matchMedia = vi.fn(() => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal('matchMedia', matchMedia)
  vi.spyOn(api, 'publicBracket').mockResolvedValue({
    tournament: null,
    divisions: [{
      division: { id: '10', name: 'Maroon', slug: 'maroon', position: 1 },
      rounds: [
        { round: 'quarterfinal', label: 'Quarterfinals', games: [game] },
        { round: 'semifinal', label: 'Semifinals', games: [{ ...game, id: 's1', bracketCode: 'MSF1' }] },
      ],
    }],
  })

  const { container } = render(<MemoryRouter><BracketPage /></MemoryRouter>)
  await screen.findByText('MQF1')
  expect(matchMedia).toHaveBeenCalledWith('(max-width: 960px)')
  expect(screen.getAllByText('MQF1')).toHaveLength(1)
  expect(container.querySelectorAll('.bracket-desktop-grid')).toHaveLength(mobile ? 0 : 1)
  expect(container.querySelectorAll('.bracket-mobile-round')).toHaveLength(mobile ? 1 : 0)
  expect(container.querySelectorAll('.bracket-round-pills')).toHaveLength(mobile ? 1 : 0)
  expect(container.querySelectorAll('.bracket-card')).toHaveLength(mobile ? 1 : 2)

  if (mobile) fireEvent.click(screen.getByRole('button', { name: /Semifinals/ }))
  expect(screen.getAllByText('MSF1')).toHaveLength(1)
})
