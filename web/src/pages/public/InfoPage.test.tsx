import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { InfoPage } from './InfoPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('renders the requested season, venue, rules and current ticket source', async () => {
  const request = vi.spyOn(api, 'publicInfo').mockResolvedValue({
    tournament: { id: '42', year: 2032, name: 'FD Alumni Cup', startDate: '2032-07-01', endDate: '2032-07-31', status: 'upcoming' },
    infoGuide: {
      venueName: 'West Gym', venueAddress: '123 West Drive', ticketSourceName: 'HåfaPass', ticketSourceUrl: '/tickets',
      ticketSummary: 'Check HåfaPass for session pricing.', doorInfo: 'Use the west entrance.',
      eligibilityHighlights: ['Bring a signed waiver.'], gameRuleHighlights: ['Use a stop clock.'],
      conductHighlights: ['Keep the bench clean.'], bylawDisclaimer: 'Follow the tournament bylaws.',
    },
  })
  render(<MemoryRouter initialEntries={['/info?year=2032']}><InfoPage /></MemoryRouter>)

  expect(await screen.findByText('2032 · FD Alumni Cup')).toBeInTheDocument()
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ year: '2032' }))
  expect(screen.getByRole('heading', { name: 'West Gym' })).toBeInTheDocument()
  expect(screen.getByText('Use a stop clock.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Tournament tickets' })).toHaveAttribute('href', '/tickets')
  expect(screen.queryByText(/2026|GuamTime/)).not.toBeInTheDocument()
})

it('keeps general guidance and the tickets route available offline', async () => {
  vi.spyOn(api, 'publicInfo').mockRejectedValue(new Error('Offline'))
  render(<MemoryRouter><InfoPage /></MemoryRouter>)
  expect(await screen.findByRole('status')).toHaveTextContent('general tournament guidance')
  expect(screen.getByRole('link', { name: 'Tournament tickets' })).toHaveAttribute('href', '/tickets')
  expect(screen.queryByText(/2026|GuamTime/)).not.toBeInTheDocument()
})
