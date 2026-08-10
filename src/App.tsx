import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import { Spinner } from '@/components/ui/Spinner'
import { LandingPage } from '@/pages/LandingPage'

// Code-split the heavier / less-frequent routes.
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const ReportPage = lazy(() => import('@/pages/ReportPage').then((m) => ({ default: m.ReportPage })))
const GrievanceAssistantPage = lazy(() => import('@/pages/GrievanceAssistantPage').then((m) => ({ default: m.GrievanceAssistantPage })))
const CommunityHeroAssistantPage = lazy(() => import('@/pages/CommunityHeroAssistantPage').then((m) => ({ default: m.CommunityHeroAssistantPage })))
const IssueDetailPage = lazy(() => import('@/pages/IssueDetailPage').then((m) => ({ default: m.IssueDetailPage })))
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AuthPage = lazy(() => import('@/pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const SuperAdminPage = lazy(() => import('@/pages/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage })))
const TransparencyPage = lazy(() => import('@/pages/TransparencyPage').then((m) => ({ default: m.TransparencyPage })))
const KioskPage = lazy(() => import('@/pages/KioskPage').then((m) => ({ default: m.KioskPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

function Loading() {
  return <div className="grid min-h-[60vh] place-items-center"><Spinner /></div>
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<AppShell />}>
          <Route index element={<LandingPage />} />
          <Route path="map" element={<HomePage />} />
          <Route path="issue/:id" element={<IssueDetailPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="transparency" element={<TransparencyPage />} />
          <Route path="kiosk" element={<KioskPage />} />
          <Route path="report" element={<RequireAuth><ReportPage /></RequireAuth>} />
          <Route path="grievance" element={<GrievanceAssistantPage />} />
          <Route path="assistant" element={<RequireAuth><CommunityHeroAssistantPage /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route
            path="dashboard"
            element={<RequireRole roles={['authority', 'supervisor', 'volunteer', 'superadmin']}><DashboardPage /></RequireRole>}
          />
          <Route
            path="admin"
            element={
              <RequireRole roles={['superadmin']}>
                <SuperAdminPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
