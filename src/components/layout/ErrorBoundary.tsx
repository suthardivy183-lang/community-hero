import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Stops a single component error from white-screening the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook a real reporter (Sentry/Logflare) here in production.
    console.error('Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[60vh] place-items-center px-4 text-center">
          <div className="max-w-md">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-status-rejected/15 text-status-rejected">
              <AlertTriangle className="size-6" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-1 text-sm text-muted">
              An unexpected error occurred. Try reloading — your data is safe.
            </p>
            <button
              onClick={() => window.location.assign('/')}
              className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
