import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { AdminLayout } from '../AdminLayout'
import type { CurrentUser } from '../../lib/types'

const auth = vi.hoisted(() => ({ isSignedIn: true, user: null as CurrentUser | null }))
vi.mock('../../contexts/AuthContext', () => ({ useAuthContext: () => auth }))
vi.mock('../../hooks/useBackendAvailability', () => ({ useBackendAvailabilityContext: () => ({ isChecking: false, isUnavailable: false }) }))
vi.mock('@clerk/clerk-react', () => ({ SignOutButton: ({ children }: { children: React.ReactNode }) => children, SignInButton: () => null }))

const organizer: CurrentUser = {
  id: '1', fullName: 'Test Organizer', firstName: 'Test', lastName: 'Organizer', email: 'organizer@example.test',
  clerkId: null, role: 'staff', active: true, isAdmin: false, isStaff: false,
}

function open(user: CurrentUser, path: string) {
  auth.user = user
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/admin" element={<AdminLayout />}><Route path="*" element={<h1>Destination</h1>} /></Route>
  </Routes></MemoryRouter>)
}

it('groups the admin modules and shows the current section and signed-in user in the topbar', () => {
  const { container } = open({ ...organizer, isSuperAdmin: true }, '/admin/divisions')
  const navigation = screen.getByRole('navigation', { name: 'Admin navigation' })
  expect([...navigation.querySelectorAll('.admin-nav-section p')].map((heading) => heading.textContent))
    .toEqual(['Overview', 'Host Year', 'Tournament', 'System'])
  const topbar = within(container.querySelector('.admin-topbar') as HTMLElement)
  expect(topbar.getByText('Schedule & Teams / Teams & Divisions')).toBeInTheDocument()
  expect(topbar.getByText('Test Organizer · Super Admin')).toBeInTheDocument()
  expect(container.querySelector('.admin-topbar svg')).toBeNull()
})

it.each([
  ['finance_and_reimbursements', 'campaign', 'Host Year', 'Board Finance', '/admin/campaign/finance'],
  ['scores_and_stats', 'tournament', 'Tournament', 'Scores & Standings', '/admin/scorekeeper'],
])('renders only a populated group for a user with %s', (capability, scopeType, section, link, path) => {
  open({ ...organizer, capabilities: [{ capability, scopeType, scopeIds: ['1'], actions: ['view'], allScopes: false }] }, path)
  const navigation = screen.getByRole('navigation', { name: 'Admin navigation' })
  expect([...navigation.querySelectorAll('.admin-nav-section p')].map((heading) => heading.textContent)).toEqual([section])
  expect(within(navigation).getAllByRole('link').map((item) => item.textContent)).toEqual(expect.arrayContaining([link]))
  expect(navigation.querySelectorAll('.admin-nav-list a')).toHaveLength(1)
})
