import { useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { MapPin, Plus, Trophy, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Header } from './Header'
import { useAuth } from '@/features/auth/AuthProvider'
import { setLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function AppShell() {
  const { profile } = useAuth()
  // Apply the user's saved language preference once their profile loads.
  useEffect(() => {
    if (profile?.language) setLanguage(profile.language)
  }, [profile?.language])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  )
}

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
    isActive ? 'text-primary' : 'text-muted',
  )

function MobileNav() {
  const { t } = useTranslation()
  return (
    <nav className="sticky bottom-0 z-40 grid grid-cols-4 border-t border-border bg-paper/95 backdrop-blur sm:hidden">
      <NavLink to="/map" className={mobileLink}>
        <MapPin className="size-5" /> {t('nav.map')}
      </NavLink>
      <NavLink to="/report" className={mobileLink}>
        <Plus className="size-5" /> {t('nav.report')}
      </NavLink>
      <NavLink to="/leaderboard" className={mobileLink}>
        <Trophy className="size-5" /> {t('nav.ranks')}
      </NavLink>
      <NavLink to="/profile" className={mobileLink}>
        <User className="size-5" /> {t('nav.me')}
      </NavLink>
    </nav>
  )
}
