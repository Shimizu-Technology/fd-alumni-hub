import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { HardwoodCourtMeter } from '../HardwoodCourtMeter'

const meter = {
  enabled: true,
  goalCents: 1_000_000,
  raisedCents: 420_000,
  percent: 42,
  goalReached: false,
  updatedAt: '2026-07-08T09:00:00Z',
} as const

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('draws the proportional fill and exposes the raised amount and remaining funds', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  const { container } = render(<HardwoodCourtMeter meter={meter} />)
  const bar = screen.getByRole('progressbar', { name: 'Fundraising goal progress' })
  expect(bar).toHaveAttribute('aria-valuemin', '0')
  expect(bar).toHaveAttribute('aria-valuemax', '100')
  expect(bar).toHaveAttribute('aria-valuenow', '42')
  expect(bar).toHaveAttribute('aria-valuetext', 'Raised $4,200 of $10,000')
  expect(bar.firstElementChild).toHaveStyle({ transform: 'scaleX(0.42)' })
  expect(container.querySelector('.host-meter-court-fill')).toHaveStyle({ clipPath: 'inset(0 58% 0 0)' })
  expect(container.querySelector('.host-meter--motion')).toBeNull()
  expect(screen.getByText('$5,800 remaining toward the host-year goal.')).toBeInTheDocument()
  expect(screen.getByText(/^Updated/)).toBeInTheDocument()
})

it('clamps an over-goal fill and keeps the actual total visible', () => {
  render(<HardwoodCourtMeter meter={{ ...meter, raisedCents: 1_200_000, percent: 120, goalReached: true }} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  expect(screen.getByRole('heading', { name: 'Raised $12,000 of $10,000' })).toBeInTheDocument()
  expect(screen.getByText('100%')).toBeInTheDocument()
  expect(screen.getByText('Goal reached')).toBeInTheDocument()
})

it('guards NaN percent and avoids showing 100% before goal is reached', () => {
  const { rerender } = render(<HardwoodCourtMeter meter={{ ...meter, percent: Number.NaN }} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  expect(screen.getByText('0%')).toBeInTheDocument()

  rerender(<HardwoodCourtMeter meter={{ ...meter, raisedCents: 998_000, percent: 99.8, goalReached: false }} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '99')
  expect(screen.getByText('99%')).toBeInTheDocument()
})
