import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { staticChampionRecords } from '../../lib/staticChampions'
import { FindYourClassCard } from '../FindYourClassCard'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('defaults to the host class and credits its shared Maroon title offline', () => {
  render(<MemoryRouter><FindYourClassCard hostClassYear={2017} /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Class of 2017' })).toBeInTheDocument()
  expect(screen.getByText('Host Class')).toBeInTheDocument()
  expect(screen.getByText('2024 Maroon Champs · 58–56')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View class profile' })).toHaveAttribute('href', '/classes/17')
})

it('finds dynasties and division titles from the bundled archive with partial live data', () => {
  const championRecords = staticChampionRecords().filter(({ year }) => year === 2026)
  render(<MemoryRouter><FindYourClassCard championRecords={championRecords} hostClassYear={2040} /></MemoryRouter>)
  const year = screen.getByLabelText('Graduating year')
  expect(year).toHaveValue('2017')
  expect(within(year).getAllByRole('option')).toHaveLength(53)

  fireEvent.click(screen.getByRole('button', { name: '00s' }))
  expect(year).toHaveValue('2007')
  fireEvent.change(year, { target: { value: '2006' } })
  expect(screen.getByText('8× Champions')).toBeInTheDocument()

  fireEvent.change(year, { target: { value: '1982' } })
  expect(screen.getByText('7× Champions')).toBeInTheDocument()
  fireEvent.change(year, { target: { value: '1991' } })
  expect(screen.getByText(/2018 Gold Champs/)).toBeInTheDocument()
  expect(screen.getByText('2026 Platinum Champs · 41–20')).toBeInTheDocument()

  fireEvent.change(year, { target: { value: '2003' } })
  expect(screen.getByText('2026 Gold Champs')).toBeInTheDocument()
  expect(screen.getAllByText('2026 Gold Champs')).toHaveLength(1)
  fireEvent.change(year, { target: { value: '2026' } })
  expect(screen.getByText('Brotherhood Competitor')).toBeInTheDocument()
})

it('links to a safely encoded WhatsApp share with the selected class URL', () => {
  render(<MemoryRouter><FindYourClassCard hostClassYear={2006} /></MemoryRouter>)
  const share = screen.getByRole<HTMLAnchorElement>('link', { name: 'Share to WhatsApp' })
  expect(share).toHaveAttribute('target', '_blank')
  expect(share).toHaveAttribute('rel', 'noopener noreferrer')
  const url = new URL(share.href)
  expect(url.origin).toBe('https://wa.me')
  expect(url.searchParams.get('text')).toContain('FD Class of 2006 at The Jungle · 8× Champions')
  expect(url.searchParams.get('text')).toContain(`${window.location.origin}/classes/06`)
})

it.each(['returns null', 'throws'])('reports that image export is unavailable when canvas %s', (failure) => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    if (failure === 'throws') throw new Error('Canvas unavailable')
    return null
  })
  render(<MemoryRouter><FindYourClassCard /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Save Card Image' }))
  expect(screen.getByRole('status')).toHaveTextContent('Card image unavailable on this device.')
})
