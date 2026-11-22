import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { staticChampionRecords } from '../../lib/staticChampions'
import { JungleRaftersWall } from '../JungleRaftersWall'

afterEach(cleanup)

function renderRafters() {
  render(<MemoryRouter><JungleRaftersWall records={staticChampionRecords()} /></MemoryRouter>)
  return screen.getByRole('region', { name: 'The Jungle Rafters' })
}

it('defaults to the recent era and filters editions without losing the division banners', () => {
  const rafters = within(renderRafters())
  expect(rafters.getByRole('button', { name: '2015–2026' })).toHaveAttribute('aria-pressed', 'true')
  expect(rafters.getByRole('button', { name: /2026.*Class of 1991.*Platinum/ })).toBeInTheDocument()
  expect(rafters.queryByRole('button', { name: /1987 Spring/ })).not.toBeInTheDocument()

  fireEvent.click(rafters.getByRole('button', { name: '1985–1994' }))
  expect(rafters.getByRole('button', { name: /1987 Spring/ })).toBeInTheDocument()
  expect(rafters.queryByRole('button', { name: /2026.*Platinum/ })).not.toBeInTheDocument()
  fireEvent.click(rafters.getByRole('button', { name: 'All' }))
  expect(rafters.getByRole('button', { name: /1987 Spring/ })).toBeInTheDocument()
  expect(rafters.getByRole('button', { name: /2026.*Platinum/ })).toBeInTheDocument()
})

it('shows runner-up, score and highlight, moves focus, and restores focus when flipped back', () => {
  const rafters = within(renderRafters())
  const banner = rafters.getByRole('button', { name: /2024.*Class of 2016\/17.*Maroon/ })
  expect(rafters.queryByRole('link', { name: 'View 2024 archive' })).not.toBeInTheDocument()
  fireEvent.click(banner)
  const back = rafters.getByRole('button', { name: 'Flip back' })
  const details = rafters.getByRole('group', { name: '2024 · Class of 2016/17' })
  expect(details).toHaveFocus()
  expect(within(details).getByText('Final score · 58–56')).toBeInTheDocument()
  expect(within(details).getByText('Runner-up · Class of 2013')).toBeInTheDocument()
  expect(within(details).getByText(/Leon Shimizu.*game-winning buzzer-beater/)).toBeInTheDocument()
  expect(rafters.getByRole('link', { name: 'View 2024 archive' })).toHaveAttribute('href', '/history/2024')
  expect(rafters.getByRole('link', { name: 'Class profile' })).toHaveAttribute('href', '/classes/16')
  fireEvent.click(back)
  expect(banner).toHaveFocus()
})

it('keeps the cancelled edition and its archive link without a champion link', () => {
  const rafters = within(renderRafters())
  fireEvent.click(rafters.getByRole('button', { name: /2020.*Tournament cancelled/ }))
  expect(rafters.getByText(/cancelled because of COVID-19/)).toBeInTheDocument()
  expect(rafters.getByRole('link', { name: 'View 2020 archive' })).toHaveAttribute('href', '/history/2020')
  expect(rafters.queryByRole('link', { name: 'Class profile' })).not.toBeInTheDocument()
})
