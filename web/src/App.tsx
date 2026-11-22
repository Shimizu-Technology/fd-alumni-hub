import { AdminSiteModePage } from './pages/admin/AdminSiteModePage'
import { NotFoundPage } from './pages/public/NotFoundPage'
import { TeamsPage } from './pages/public/TeamsPage'
import { ClerkProvider } from '@clerk/clerk-react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { BackendAvailabilityProvider } from './hooks/useBackendAvailability'
import { PublicLayout } from './components/PublicLayout'
import {
  AdminIndexRoute,
  RequireCapabilityRoute,
  AdminLayout,
} from './components/AdminLayout'
import { HomePage } from './pages/public/HomePage'
import { HostYearPage } from './pages/public/HostYearPage'
import { TodayPage } from './pages/public/TodayPage'
import { SchedulePage } from './pages/public/SchedulePage'
import { BracketPage } from './pages/public/BracketPage'
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
import { AdminAuditHistoryPage } from './pages/admin/AdminAuditHistoryPage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminTournamentsPage } from './pages/admin/AdminTournamentsPage'
import { AdminTournamentDetailPage } from './pages/admin/AdminTournamentDetailPage'
import { AdminTournamentWizardPage } from './pages/admin/AdminTournamentWizardPage'
import { AdminScheduleImportPage } from './pages/admin/AdminScheduleImportPage'
import { AdminGamesPage } from './pages/admin/AdminGamesPage'
import { AdminScorekeeperPage } from './pages/admin/AdminScorekeeperPage'
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
            <Route path="bracket" element={<BracketPage />} />
            <Route path="standings" element={<StandingsPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="watch" element={<WatchPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="history/:year" element={<HistoryDetailPage />} />
            <Route path="classes/:classKey" element={<ClassProfilePage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="teams/:teamId" element={<TeamProfilePage />} />
            <Route path="sponsors" element={<SponsorsPage />} />
            <Route path="info" element={<InfoPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminIndexRoute staffElement={<AdminOverviewPage />} />} />
            <Route path="finance" element={<FinanceRedirect />} />
            <Route path="campaign/finance" element={<RequireCapabilityRoute><AdminCampaignFinancePage /></RequireCapabilityRoute>} />
            <Route path="campaign/host-year" element={<RequireCapabilityRoute><AdminCampaignHostYearPage /></RequireCapabilityRoute>} />
            <Route path="tournaments" element={<RequireCapabilityRoute><AdminTournamentsPage /></RequireCapabilityRoute>} />
            <Route path="tournaments/setup" element={<RequireCapabilityRoute><AdminTournamentWizardPage /></RequireCapabilityRoute>} />
            <Route path="tournaments/:tournamentId" element={<RequireCapabilityRoute><AdminTournamentDetailPage /></RequireCapabilityRoute>} />
            <Route path="import" element={<RequireCapabilityRoute><AdminScheduleImportPage /></RequireCapabilityRoute>} />
            <Route path="scorekeeper" element={<RequireCapabilityRoute><AdminScorekeeperPage /></RequireCapabilityRoute>} />
            <Route path="games" element={<RequireCapabilityRoute><AdminGamesPage /></RequireCapabilityRoute>} />
            <Route path="game-day" element={<RequireCapabilityRoute><AdminGameDayPage /></RequireCapabilityRoute>} />
            <Route path="standings" element={<RequireCapabilityRoute><AdminStandingsPage /></RequireCapabilityRoute>} />
            <Route path="divisions" element={<RequireCapabilityRoute><AdminDivisionsPage /></RequireCapabilityRoute>} />
            <Route path="links" element={<RequireCapabilityRoute><AdminLinksPage /></RequireCapabilityRoute>} />
            <Route path="missing-links" element={<RequireCapabilityRoute><AdminMissingLinksPage /></RequireCapabilityRoute>} />
            <Route path="news" element={<RequireCapabilityRoute><AdminNewsPage /></RequireCapabilityRoute>} />
            <Route path="media" element={<RequireCapabilityRoute><AdminMediaPage /></RequireCapabilityRoute>} />
            <Route path="sponsors" element={<RequireCapabilityRoute><AdminSponsorsPage /></RequireCapabilityRoute>} />
            <Route path="campaigns" element={<RequireCapabilityRoute><AdminCampaignsPage /></RequireCapabilityRoute>} />
            <Route path="site-mode" element={<RequireCapabilityRoute><AdminSiteModePage /></RequireCapabilityRoute>} />
            <Route path="audit" element={<RequireCapabilityRoute><AdminAuditHistoryPage /></RequireCapabilityRoute>} />
            <Route path="people" element={<RequireCapabilityRoute><AdminPeoplePage /></RequireCapabilityRoute>} />
            <Route path="ingest" element={<RequireCapabilityRoute><AdminIngestPage /></RequireCapabilityRoute>} />
          </Route>
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

function FinanceRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/admin/campaign/finance${search}`} replace />
}
