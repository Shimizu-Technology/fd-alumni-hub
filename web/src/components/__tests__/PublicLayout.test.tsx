import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PublicLayout } from '../PublicLayout'
import * as backendHook from '../../hooks/useBackendAvailability'

describe('PublicLayout', () => {
  it('renders offline status banner with Retry button when API is unavailable', () => {
    const retry = vi.fn(async () => {})
    vi.spyOn(backendHook, 'useBackendAvailabilityContext').mockReturnValue({
      status: 'unavailable',
      isUnavailable: true,
      isChecking: false,
      retry,
      reportUnavailable: vi.fn(),
      reportAvailable: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<div>Home Body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Live tournament services are currently paused or unreachable/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Retry connection/i }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('opens and closes the mobile site menu drawer via More button and Escape', () => {
    vi.spyOn(backendHook, 'useBackendAvailabilityContext').mockReturnValue({
      status: 'available',
      isUnavailable: false,
      isChecking: false,
      retry: vi.fn(async () => {}),
      reportUnavailable: vi.fn(),
      reportAvailable: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<div>Home Body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const moreBtn = screen.getByRole('button', { name: /Open more menu/i })
    fireEvent.click(moreBtn)
    expect(screen.getByRole('dialog', { name: /Site menu/i })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /Site menu/i })).not.toBeInTheDocument()
  })
})
