import { Link, NavLink, useNavigate } from 'react-router-dom'
import { MapPin, Plus, Trophy, LayoutDashboard, LogOut, User, Sparkles, Globe, Shield } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { ROLE_LABELS, LANGUAGE_LABELS, type AppLanguage } from '@/lib/issues'
import { setLanguage } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { NotificationBell } from './NotificationBell'
import { cn } from '@/lib/utils'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-primary-tint text-primary' : 'text-ink-soft hover:bg-surface-sunk hover:text-ink',
  )

export function Header() {
  const { session, profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isStaff = role === 'authority' || role === 'volunteer' || role === 'superadmin'

  function pickLanguage(lng: AppLanguage) {
    setLanguage(lng)
    if (session) void supabase.from('profiles').update({ language: lng }).eq('id', session.user.id)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-fg shadow-[var(--shadow-card)]">
            <Sparkles className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Community<span className="text-primary">Hero</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 sm:flex">
          <NavLink to="/map" className={navLinkClass}>
            <MapPin className="size-4" /> {t('nav.map')}
          </NavLink>
          {isStaff ? (
            <NavLink to="/dashboard" className={navLinkClass}>
              <LayoutDashboard className="size-4" /> {t('nav.dashboard')}
            </NavLink>
          ) : null}
          <NavLink to="/leaderboard" className={navLinkClass}>
            <Trophy className="size-4" /> {t('nav.leaderboard')}
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-ink-soft transition-colors hover:border-border-strong" aria-label="Language">
                <Globe className="size-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-40 rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-pop)]">
                {(Object.keys(LANGUAGE_LABELS) as AppLanguage[]).map((lng) => (
                  <DropdownMenu.Item key={lng} onSelect={() => pickLanguage(lng)} className="cursor-pointer rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-sunk">
                    {LANGUAGE_LABELS[lng]}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <Button size="sm" onClick={() => navigate('/report')}>
            <Plus className="size-4" /> {t('nav.report')}
          </Button>

          {session && profile ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 transition-colors hover:border-border-strong">
                  <Avatar name={profile.full_name} url={profile.avatar_url} />
                  <span className="hidden text-sm font-semibold sm:inline">{profile.points} pts</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-pop)]"
                >
                  <div className="px-2.5 py-2">
                    <p className="truncate text-sm font-semibold">{profile.full_name ?? 'Citizen'}</p>
                    <p className="text-xs text-muted">{role ? ROLE_LABELS[role] : ''}</p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <MenuItem onSelect={() => navigate('/profile')} icon={<User className="size-4" />}>
                    My Profile
                  </MenuItem>
                  {isStaff ? (
                    <MenuItem onSelect={() => navigate('/dashboard')} icon={<LayoutDashboard className="size-4" />}>
                      Dashboard
                    </MenuItem>
                  ) : null}
                  {role === 'superadmin' ? (
                    <MenuItem onSelect={() => navigate('/admin')} icon={<Shield className="size-4" />}>
                      Administration
                    </MenuItem>
                  ) : null}
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <MenuItem onSelect={signOut} icon={<LogOut className="size-4" />}>
                    Sign out
                  </MenuItem>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
              {t('nav.signin')}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuItem({
  children,
  icon,
  onSelect,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  onSelect: () => void
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink outline-none transition-colors data-[highlighted]:bg-surface-sunk"
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  )
}

export function Avatar({ name, url, size = 32 }: { name: string | null; url: string | null; size?: number }) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase()
  if (url) {
    return <img src={url} alt={name ?? ''} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="grid place-items-center rounded-full bg-accent font-semibold text-accent-fg"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  )
}
