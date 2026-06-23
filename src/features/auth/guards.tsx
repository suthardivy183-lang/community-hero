import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import type { UserRole } from '@/lib/issues'
import { Spinner } from '@/components/ui/Spinner'

function FullPageSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner />
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/auth" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { session, role, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/auth" replace />
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />
  return <>{children}</>
}
