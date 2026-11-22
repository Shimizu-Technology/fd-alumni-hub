import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { staticChampionsForYear, staticTitleCounts } from '../../lib/staticChampions'
import type { Article, Game, MediaAsset, Tournament } from '../../lib/types'
import { GalleryPage } from './GalleryPage'
import { HistoryDetailPage } from './HistoryDetailPage'
import { HistoryPage } from './HistoryPage'

const season: Tournament = {
  id: '26', name: 'FD Alumni Basketball Tournament', year: 2026,
  startDate: '2026-07-03', endDate: '2026-07-30', status: 'completed',
  hostClassLabel: 'Class of 2016', theme: 'Summer of Sixteen', editionNumber: 43,
}
const video: MediaAsset = {
  id: '33', tournamentId: '26', gameId: null, title: 'Gold Championship Broadcast', source: 'Acdavate',
  imageUrl: null, articleUrl: null, caption: null, tags: null, tagList: [], takenAt: null,
  mediaType: 'video', videoProvider: 'youtube', externalVideoId: 'gExNQKCX60E', divisionSlug: 'gold',
}
const photo: MediaAsset = {
  id: '34', tournamentId: '26', gameId: null, title: 'Opening Night Photo', source: 'GSPN',
  imageUrl: 'https://example.com/opening.jpg', articleUrl: null, caption: null, tags: null, tagList: [], takenAt: null,
}
const article: Article = {
  id: '15', tournamentId: '26', gameId: null, title: 'Maroon finals recap', source: 'GSPN',
  url: 'https://example.com/recap', publishedAt: null, imageUrl: null, excerpt: null, kind: 'championship', photoCount: 18,
}
const game: Game = {
  id: '55', tournamentId: '26', homeTeamId: '1', awayTeamId: '2',
  startTime: '2026-07-30T00:00:00+10:00', dateOnly: true, venue: null, status: 'final',
  homeScore: 61, awayScore: 49, streamUrl: null, ticketUrl: null, notes: null, division: 'Maroon', bracketCode: null,
  topPerformers: ['Noah Tenorio 19 pts'],
}
const champions = staticChampionsForYear(2026).map((record) => ({
  ...record,
  highlightVideoId: record.bracket === 'gold' ? video.id : null,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function openArchive(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:year" element={<HistoryDetailPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function mockYearArchive() {
  vi.spyOn(api, 'publicSchedule').mockResolvedValue({ tournament: season, games: [game], teams: [], divisions: [], phases: [] })
  vi.spyOn(api, 'publicStandings').mockResolvedValue({ tournament: season, standings: [], divisions: [], scoreCoverage: { scoredGames: 0, totalGames: 0, percent: 0 } })
  vi.spyOn(api, 'publicArticles').mockResolvedValue({ tournament: season, articles: [article] })
  vi.spyOn(api, 'publicMedia').mockResolvedValue({ tournament: season, mediaAssets: [video, photo] })
  vi.spyOn(api, 'publicSponsors').mockResolvedValue({ tournament: season, sponsors: [] })
}

it('shows division titles, source and video links, and explains primary class credits on History', async () => {
  vi.spyOn(api, 'publicTournaments').mockResolvedValue({ activeTournament: season, tournaments: [season] })
  vi.spyOn(api, 'publicChampions').mockResolvedValue({ championRecords: champions, titleCounts: staticTitleCounts(), entryTitleCounts: [] })
  openArchive('/history')

  const timeline = (await screen.findByRole('heading', { name: 'Tournament champions' })).closest('.panel')! as HTMLElement
  const gold = within(timeline).getByText('2026 Gold').closest('article')!
  expect(within(gold).getByText('Gold')).toBeInTheDocument()
  expect(within(gold).getByRole('link', { name: /highlight video/i })).toHaveAttribute('href', '/history/2026#archive-video-33')
  const platinum = within(timeline).getByText('2026 Platinum').closest('article')!
  expect(within(platinum).getByText(/Luis Cruz/)).toBeInTheDocument()
  expect(within(platinum).getByRole('link', { name: /source/i })).toHaveAttribute('href', expect.stringContaining('guamsportsnetwork.com'))
  expect(screen.getByText(/Shared-team primary wins/)).toHaveTextContent('Gold and Platinum titles')
})

it('shows host details, champion media, categorized coverage and top performers in the year archive', async () => {
  mockYearArchive()
  vi.spyOn(api, 'publicChampions').mockResolvedValue({ championRecords: champions, titleCounts: [], entryTitleCounts: [] })
  openArchive('/history/2026')

  expect(await screen.findByText('Host Class · Class of 2016')).toBeInTheDocument()
  expect(screen.getByText('Edition #43')).toBeInTheDocument()
  expect(screen.getByText('Theme · Summer of Sixteen')).toBeInTheDocument()
  expect(screen.getByText('Noah Tenorio 19 pts')).toBeInTheDocument()
  expect(screen.getByText('Championship', { exact: true })).toBeInTheDocument()
  expect(screen.getByText('18 photos')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Highlight Videos & Broadcasts' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /highlight video/i })).toHaveAttribute('href', '/history/2026#archive-video-33')
  expect(screen.getByRole('button', { name: /play gold championship broadcast/i })).toBeInTheDocument()
})

it('shows the enriched static records even when History and year endpoints fail', async () => {
  mockYearArchive()
  vi.spyOn(api, 'publicTournaments').mockRejectedValue(new Error('Offline'))
  vi.spyOn(api, 'publicChampions').mockRejectedValue(new Error('Offline'))
  openArchive('/history')

  expect(await screen.findByText(/preserved offline champion archive/)).toBeInTheDocument()
  const timeline = screen.getByRole('heading', { name: 'Tournament champions' }).closest('.panel')! as HTMLElement
  const maroon = within(timeline).getByText('2024 Maroon').closest('article')!
  expect(within(maroon).getByText(/Leon Shimizu/)).toBeInTheDocument()
  fireEvent.click(within(maroon).getByRole('link', { name: 'Class of 2016/17' }))
  expect(await screen.findByText(/preserved offline champion records/)).toBeInTheDocument()
  expect(screen.getByText('2024 Gold')).toBeInTheDocument()
})

it('filters the cross-year gallery to videos or photos', async () => {
  const request = vi.spyOn(api, 'publicMedia').mockImplementation(async ({ mediaType } = {}) => ({
    tournament: null,
    mediaAssets: mediaType === 'video' ? [video] : mediaType === 'photo' ? [photo] : [video, photo],
  }))
  openArchive('/gallery')

  expect(await screen.findByText(photo.title)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /play gold championship broadcast/i })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Videos' }))
  expect(await screen.findByText(video.title)).toBeInTheDocument()
  expect(screen.queryByText(photo.title)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Videos' })).toHaveAttribute('aria-pressed', 'true')
  expect(request).toHaveBeenLastCalledWith({ archive: true, limit: 200, mediaType: 'video' })

  fireEvent.click(screen.getByRole('button', { name: 'Photos' }))
  expect(await screen.findByText(photo.title)).toBeInTheDocument()
  expect(screen.queryByText(video.title)).not.toBeInTheDocument()
})
