import { ClerkProvider } from '@clerk/clerk-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { BackendAvailabilityProvider } from './hooks/useBackendAvailability'
import { PublicLayout } from './components/PublicLayout'
import {
  AdminIndexRoute,
  AdminLayout,
  RequireAdminRoute,
  RequireCampaignRoute,
  RequireStaffRoute,
} from './components/AdminLayout'
import { HomePage } from './pages/public/HomePage'
import { HostYearPage } from './pages/public/HostYearPage'
import { TodayPage } from './pages/public/TodayPage'
import { SchedulePage } from './pages/public/SchedulePage'
import { StandingsPage } from './pages/public/StandingsPage'
import { TicketsPage } from './pages/public/TicketsPage'
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
import { AdminTournamentWizardPage } from './pages/admin/AdminTournamentWizardPage'
import { AdminScheduleImportPage } from './pages/admin/AdminScheduleImportPage'
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
import { AdminCampaignHostYearPage } from './pages/admin/AdminCampaignHostYearPage'
import { AdminCampaignFinancePage } from './pages/admin/AdminCampaignFinancePage'
import { AdminCampaignsPage } from './pages/admin/AdminCampaignsPage'
import { AdminPeoplePage } from './pages/admin/AdminPeoplePage'

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
const clerkEnabled = Boolean(clerkKey && clerkKey.startsWith('pk_'))
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1'
const HEALTH_URL = new URL('/health', API_BASE_URL).toString()

export function App() {
  const content = (
    <BackendAvailabilityProvider healthUrl={HEALTH_URL}>
      <AuthProvider isClerkEnabled={clerkEnabled}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="host-year" element={<HostYearPage />} />
            <Route path="host-year/:slug" element={<HostYearPage />} />
            <Route path="today" element={<TodayPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="standings" element={<StandingsPage />} />
            <Route path="tickets" element={<TicketsPage />} />
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
            <Route index element={<AdminIndexRoute staffElement={<AdminOverviewPage />} />} />
            <Route path="campaign/finance" element={<RequireCampaignRoute><AdminCampaignFinancePage /></RequireCampaignRoute>} />
            <Route path="campaign/host-year" element={<RequireCampaignRoute><AdminCampaignHostYearPage /></RequireCampaignRoute>} />
            <Route path="tournaments" element={<RequireStaffRoute><AdminTournamentsPage /></RequireStaffRoute>} />
            <Route path="tournaments/setup" element={<RequireAdminRoute><AdminTournamentWizardPage /></RequireAdminRoute>} />
            <Route path="tournaments/:tournamentId" element={<RequireStaffRoute><AdminTournamentDetailPage /></RequireStaffRoute>} />
            <Route path="import" element={<RequireStaffRoute><AdminScheduleImportPage /></RequireStaffRoute>} />
            <Route path="games" element={<RequireStaffRoute><AdminGamesPage /></RequireStaffRoute>} />
            <Route path="game-day" element={<RequireStaffRoute><AdminGameDayPage /></RequireStaffRoute>} />
            <Route path="standings" element={<RequireStaffRoute><AdminStandingsPage /></RequireStaffRoute>} />
            <Route path="divisions" element={<RequireStaffRoute><AdminDivisionsPage /></RequireStaffRoute>} />
            <Route path="links" element={<RequireStaffRoute><AdminLinksPage /></RequireStaffRoute>} />
            <Route path="missing-links" element={<RequireStaffRoute><AdminMissingLinksPage /></RequireStaffRoute>} />
            <Route path="news" element={<RequireStaffRoute><AdminNewsPage /></RequireStaffRoute>} />
            <Route path="media" element={<RequireStaffRoute><AdminMediaPage /></RequireStaffRoute>} />
            <Route path="sponsors" element={<RequireStaffRoute><AdminSponsorsPage /></RequireStaffRoute>} />
            <Route path="campaigns" element={<RequireAdminRoute><AdminCampaignsPage /></RequireAdminRoute>} />
            <Route path="people" element={<RequireAdminRoute><AdminPeoplePage /></RequireAdminRoute>} />
            <Route path="ingest" element={<RequireAdminRoute><AdminIngestPage /></RequireAdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BackendAvailabilityProvider>
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
