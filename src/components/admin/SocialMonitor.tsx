import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, MapPin, Check, X } from 'lucide-react'
import { useCategories } from '@/features/issues/queries'
import { useSocialMentions, usePublishMention, type SocialMention } from '@/features/admin/social'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/AuthProvider'

export function SocialMonitor() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { data: categories } = useCategories()
  const slugs = (categories ?? []).map((c) => c.slug)
  const { data: mentions, isLoading } = useSocialMentions(slugs)
  const publish = usePublishMention()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [publishing, setPublishing] = useState<string | null>(null)
  const [published, setPublished] = useState<Set<string>>(new Set())

  async function handlePublish(m: SocialMention) {
    if (!session) {
      setPublished((items) => new Set(items).add(m.id))
      return
    }
    const categoryId = categories?.find((c) => c.slug === m.categorySlug)?.id
    if (!categoryId) return
    setPublishing(m.id)
    try {
      const id = await publish.mutateAsync({ mention: m, categoryId })
      navigate(`/issue/${id}`)
    } finally {
      setPublishing(null)
    }
  }

  const visible = (mentions ?? []).filter((m) => !dismissed.has(m.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl bg-status-validated/10 px-3.5 py-2 text-sm font-medium text-status-validated">
        <Radio className="size-4" /> AI is monitoring social media for civic issues. Review and publish drafts below.
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No civic mentions to review right now.</p>
      ) : (
        visible.map((m) => (
          <Card key={m.id}>
            <CardBody>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded bg-surface-sunk px-1.5 py-0.5 font-semibold">{m.source}</span>
                <span className="font-medium">{m.author}</span>
                <span>· {m.time} ago</span>
                <span className="ml-auto rounded-full bg-status-validated/15 px-2 py-0.5 font-mono font-bold text-status-validated">
                  {Math.round(m.confidence * 100)}% civic
                </span>
              </div>
              <p className="mt-2 text-sm text-ink">{m.text}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary-tint px-2 py-0.5 font-semibold capitalize text-primary">{m.issueType}</span>
                {m.location ? (
                  <span className="inline-flex items-center gap-1 text-muted"><MapPin className="size-3.5" />{m.location}</span>
                ) : null}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => handlePublish(m)} loading={publishing === m.id} disabled={published.has(m.id)}>
                  <Check className="size-4" /> {published.has(m.id) ? 'Published (demo)' : 'Publish as complaint'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDismissed((s) => new Set(s).add(m.id))}>
                  <X className="size-4" /> Dismiss
                </Button>
              </div>
            </CardBody>
          </Card>
        ))
      )}
    </div>
  )
}
