import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { RequireCapabilityRoute } from '../AdminLayout'

vi.mock('../../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: {
      active: true,
      defaultWorkspacePath: '/admin/scorekeeper',
      capabilities: [{ capability: 'scores_and_stats', actions: ['view', 'edit'], scopeType: 'tournament', scopeIds: ['1'], allScopes: false }],
    },
  }),
}))

afterEach(cleanup)

it('redirects a scorekeeper from a hidden direct URL before mounting the page', async () => {
  const people = vi.fn(() => <p>People loaded</p>)
  const People = people
  render(
    <MemoryRouter initialEntries={['/admin/people']}>
      <Routes>
        <Route path="/admin/people" element={<RequireCapabilityRoute><People /></RequireCapabilityRoute>} />
        <Route path="/admin/scorekeeper" element={<RequireCapabilityRoute><p>Enter results</p></RequireCapabilityRoute>} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByText('Enter results')
  expect(people).not.toHaveBeenCalled()
})
