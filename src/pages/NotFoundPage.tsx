import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <p className="font-mono text-6xl font-bold text-primary">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Page not found</h1>
        <p className="mt-1 text-muted">This corner of the city doesn't exist.</p>
        <Button asChild className="mt-5"><Link to="/">Back to the map</Link></Button>
      </div>
    </div>
  )
}
