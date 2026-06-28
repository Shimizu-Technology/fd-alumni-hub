import { ClerkProvider } from '@clerk/clerk-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PublicLayout } from './components/PublicLayout'
import { AdminLayout } from './components/AdminLayout'
import { HomePage } from './pages/public/HomePage'
import { TodayPage } from './pages/public/TodayPage'
import { SchedulePage } from './pages/public/SchedulePage'
import { StandingsPage } from './pages/public/StandingsPage'
import { WatchPage } from './pages/public/WatchPage'
import { NewsPage } from './pages/public/NewsPage'
import { GalleryPage } from './pages/public/GalleryPage'
import { HistoryPage } from './pages/public/HistoryPage'
import { HistoryDetailPage } from './pages/public/HistoryDetailPage'
import { SponsorsPage } from './pages/public/SponsorsPage'
import { InfoPage } from './pages/public/InfoPage'
import { TeamProfilePage } from './pages/public/TeamProfilePage'
import { ClassProfilePage } from './pages/public/ClassProfilePage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminTournamentsPage } from './pages/admin/AdminTournamentsPage'
import { AdminTournamentDetailPage } from './pages/admin/AdminTournamentDetailPage'
import { AdminGamesPage } from './pages/admin/AdminGamesPage'
import { AdminGameDayPage } from './pages/admin/AdminGameDayPage'
import { AdminStandingsPage } from './pages/admin/AdminStandingsPage'
import { AdminDivisionsPage } from './pages/admin/AdminDivisionsPage'
import { AdminLinksPage } from './pages/admin/AdminLinksPage'
import { AdminMissingLinksPage } from './pages/admin/AdminMissingLinksPage'
import { AdminNewsPage } from './pages/admin/AdminNewsPage'
import { AdminMediaPage } from './pages/admin/AdminMediaPage'
import { AdminSponsorsPage } from './pages/admin/AdminSponsorsPage'
import { AdminIngestPage } from './pages/admin/AdminIngestPage'

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
const clerkEnabled = Boolean(clerkKey && clerkKey.startsWith('pk_'))

export function App() {
  const content = (
    <AuthProvider isClerkEnabled={clerkEnabled}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="standings" element={<StandingsPage />} />
          <Route path="watch" element={<WatchPage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:year" element={<HistoryDetailPage />} />
          <Route path="classes/:classKey" element={<ClassProfilePage />} />
          <Route path="teams/:teamId" element={<TeamProfilePage />} />
          <Route path="sponsors" element={<SponsorsPage />} />
          <Route path="info" element={<InfoPage />} />
        </Route>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="tournaments" element={<AdminTournamentsPage />} />
          <Route path="tournaments/:tournamentId" element={<AdminTournamentDetailPage />} />
          <Route path="games" element={<AdminGamesPage />} />
          <Route path="game-day" element={<AdminGameDayPage />} />
          <Route path="standings" element={<AdminStandingsPage />} />
          <Route path="divisions" element={<AdminDivisionsPage />} />
          <Route path="links" element={<AdminLinksPage />} />
          <Route path="missing-links" element={<AdminMissingLinksPage />} />
          <Route path="news" element={<AdminNewsPage />} />
          <Route path="media" element={<AdminMediaPage />} />
          <Route path="sponsors" element={<AdminSponsorsPage />} />
          <Route path="ingest" element={<AdminIngestPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )

  if (!clerkEnabled) return content

  return (
    <ClerkProvider
      publishableKey={clerkKey!}
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/admin"
      signUpFallbackRedirectUrl="/admin"
    >
      {content}
    </ClerkProvider>
  )
}
