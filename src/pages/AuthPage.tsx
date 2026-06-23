import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Sparkles, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input, Label, FieldError } from '@/components/ui/Field'

type Mode = 'signin' | 'signup'

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    navigate(from, { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        })
        if (error) throw error
        if (!data.session) {
          setNotice('Account created. If email confirmation is on, check your inbox — otherwise sign in.')
          setMode('signin')
        } else {
          navigate(from, { replace: true })
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${from}` },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Editorial brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-fg lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0, transparent 45%), radial-gradient(circle at 80% 70%, white 0, transparent 40%)' }}
        />
        <Link to="/" className="relative flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-white/15">
            <Sparkles className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">CommunityHero</span>
        </Link>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight text-white">
            Your neighbourhood, fixed faster.
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Snap a photo. AI categorises it, neighbours confirm it, and authorities are held
            accountable — with proof the fix is real.
          </p>
        </div>
        <p className="relative text-sm text-white/60">Report · Verify · Track · Resolve</p>
      </aside>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold">
            {mode === 'signin' ? 'Welcome back' : 'Join the movement'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {mode === 'signin' ? 'Sign in to report and track issues.' : 'Create your free citizen account.'}
          </p>

          <Button variant="outline" className="mt-6 w-full" onClick={handleGoogle}>
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" /> or email <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' ? (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aanya Sharma" required />
              </div>
            ) : null}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
            </div>

            {error ? <FieldError>{error}</FieldError> : null}
            {notice ? <p className="text-xs font-medium text-status-resolved">{notice}</p> : null}

            <Button type="submit" className="w-full" loading={busy}>
              <Mail className="size-4" />
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {mode === 'signin' ? "Don't have an account? " : 'Already have one? '}
            <button
              className="font-semibold text-primary hover:underline"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
                setNotice(null)
              }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  )
}
