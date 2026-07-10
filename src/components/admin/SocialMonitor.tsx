import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, MapPin, Check, X, ClipboardPaste } from 'lucide-react'
import { useCategories } from '@/features/issues/queries'
import { useSocialMentions, useAnalyseSocialPost, usePublishMention, type SocialMention } from '@/features/admin/social'
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
  const analyse = useAnalyseSocialPost()
  const publish = usePublishMention()
  const [postText, setPostText] = useState('')
  const [source, setSource] = useState('X')
  const [manualMentions, setManualMentions] = useState<SocialMention[]>([])
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

  const visible = [...manualMentions, ...(mentions ?? [])].filter((m) => !dismissed.has(m.id))

  async function handleAnalyse() {
    const text = postText.trim()
    if (!text) return
    const mention = await analyse.mutateAsync({ text, source, categorySlugs: slugs })
    setManualMentions((items) => [mention, ...items])
    setPostText('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl bg-status-validated/10 px-3.5 py-2 text-sm font-medium text-status-validated">
        <Radio className="size-4" /> AI is monitoring social media for civic issues. Review and publish drafts below.
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-2 text-base font-semibold text-ink">
            <ClipboardPaste className="size-4 text-primary" /> Paste a post
          </div>
          <p className="mt-1 text-sm text-muted">Analyse a citizen post without connecting a social API.</p>
          <textarea
            value={postText}
            onChange={(event) => setPostText(event.target.value)}
            placeholder="Paste a post about a civic issue…"
            rows={4}
            className="mt-3 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-muted" htmlFor="social-source">Source</label>
            <select
              id="social-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink"
            >
              <option>X</option>
              <option>Facebook</option>
              <option>WhatsApp</option>
              <option>Other</option>
            </select>
            <Button className="ml-auto" onClick={handleAnalyse} loading={analyse.isPending} disabled={!postText.trim()}>
              Analyse
            </Button>
          </div>
          {analyse.isError ? <p className="mt-2 text-sm text-danger">Could not analyse this post. Please try again.</p> : null}
        </CardBody>
      </Card>

      <h3 className="pt-2 text-sm font-semibold uppercase tracking-wider text-muted">Demo feed</h3>

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
