import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MapPin, ArrowLeft, Send, ShieldCheck, Sparkles } from 'lucide-react'
import {
  useIssue, useIssueMedia, useComments, useStatusHistory, useValidation,
} from '@/features/issues/queries'
import { useMyInteractions } from '@/features/issues/userState'
import { useToggleVote, useToggleConfirm, useAddComment } from '@/features/issues/mutations'
import { useAuth } from '@/features/auth/AuthProvider'
import { mediaUrl } from '@/lib/supabase'
import { STATUS_META } from '@/lib/issues'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusBadge } from '@/components/issue/StatusBadge'
import { SeverityMeter } from '@/components/issue/SeverityMeter'
import { CategoryIcon } from '@/components/issue/CategoryIcon'
import { StaffActions } from '@/components/issue/StaffActions'
import { VoteControls } from '@/components/issue/VoteControls'
import { SeverityBadge } from '@/components/issue/SeverityBadge'
import { PriorityBadge } from '@/components/issue/PriorityBadge'
import { RepairEstimate } from '@/components/issue/RepairEstimate'
import { TrustBadge } from '@/components/community/TrustBadge'
import { Avatar } from '@/components/layout/Header'
import { timeAgo } from '@/lib/utils'

export function IssueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const { data: issue, isLoading } = useIssue(id)
  const { data: media } = useIssueMedia(id)
  const { data: comments } = useComments(id)
  const { data: history } = useStatusHistory(id)
  const { data: validation } = useValidation(id)
  const { data: interactions } = useMyInteractions(session?.user.id)

  const vote = useToggleVote(id ?? '')
  const confirm = useToggleConfirm(id ?? '')
  const addComment = useAddComment(id ?? '')
  const [comment, setComment] = useState('')

  if (isLoading) return <div className="grid h-[60vh] place-items-center"><Spinner /></div>
  if (!issue) return <div className="mx-auto max-w-2xl px-4 py-10 text-center text-muted">Issue not found.</div>

  const voted = interactions?.votes.has(issue.id as string) ?? false
  const confirmed = interactions?.confirmations.has(issue.id as string) ?? false
  const originalVideo = media?.find((m) => m.type === 'video')
  const originalPhoto = media?.find((m) => m.kind === 'original' && m.type === 'photo')
  const resolution = media?.find((m) => m.kind === 'resolution')

  function requireAuthThen(fn: () => void) {
    if (!session) { window.location.href = '/auth'; return }
    fn()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to map
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {/* Media */}
          {originalVideo ? (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-border shadow-[var(--shadow-card)]">
              <video src={mediaUrl(originalVideo.storage_path)} controls playsInline poster={originalPhoto ? mediaUrl(originalPhoto.storage_path) : undefined} className="aspect-video w-full bg-ink object-contain" />
            </div>
          ) : originalPhoto ? (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-border shadow-[var(--shadow-card)]">
              <img src={mediaUrl(originalPhoto.storage_path)} alt={issue.title ?? ''} className="aspect-video w-full object-cover" />
            </div>
          ) : null}

          {/* Title block */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-semibold text-primary">
                <CategoryIcon icon={issue.category_icon} className="size-3.5" /> {issue.category_name}
              </span>
              <StatusBadge status={issue.status ?? 'reported'} size="md" />
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{issue.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-4" /> {issue.address ?? 'Location pinned on map'}
            </p>
            {issue.reporter_name ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                Reported by <span className="font-medium text-ink">{issue.reporter_name}</span>
                <TrustBadge score={issue.reporter_trust ?? 50} showScore={false} />
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {issue.severity_score != null
                ? <SeverityBadge score={issue.severity_score} />
                : <SeverityMeter severity={issue.severity ?? 5} />}
            </div>
            <p className="mt-3 leading-relaxed text-ink-soft">{issue.description}</p>
          </div>

          {/* AI explainable priority */}
          <Card>
            <CardBody>
              <h2 className="mb-2 font-display text-lg font-semibold">AI priority</h2>
              <PriorityBadge issue={issue} showReasons />
            </CardBody>
          </Card>

          {/* AI repair estimate */}
          <RepairEstimate issue={issue} />

          {/* AI validation result */}
          {validation && validation.verdict !== 'pending' ? (
            <ValidationCard verdict={validation.verdict} confidence={validation.confidence} explanation={validation.explanation} resolutionUrl={resolution ? mediaUrl(resolution.storage_path) : null} />
          ) : null}

          {/* Comments */}
          <Card>
            <CardBody>
              <h2 className="font-display text-lg font-semibold">Discussion</h2>
              <div className="mt-3 space-y-4">
                {comments?.length ? comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={c.author?.full_name ?? null} url={c.author?.avatar_url ?? null} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><span className="font-semibold">{c.author?.full_name ?? 'Citizen'}</span> <span className="text-xs text-muted">· {timeAgo(c.created_at)}</span></p>
                      <p className="text-sm text-ink-soft">{c.body}</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted">No comments yet — start the conversation.</p>}
              </div>
              <div className="mt-4 flex gap-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={session ? 'Add a comment…' : 'Sign in to comment'}
                  className="min-h-11"
                  disabled={!session}
                />
                <Button
                  size="icon"
                  disabled={!comment.trim()}
                  loading={addComment.isPending}
                  onClick={() => requireAuthThen(() => addComment.mutate({ userId: session!.user.id, body: comment.trim() }, { onSuccess: () => setComment('') }))}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar: actions + timeline */}
        <aside className="space-y-4">
          <StaffActions issue={issue} />
          <Card>
            <CardBody className="flex items-center justify-center">
              <VoteControls
                voteCount={issue.vote_count ?? 0}
                confirmCount={issue.confirm_count ?? 0}
                voted={voted}
                confirmed={confirmed}
                confirmDisabled={!!session && session.user.id === issue.reporter_id}
                onVote={() => requireAuthThen(() => vote.mutate({ userId: session!.user.id, active: voted }))}
                onConfirm={() => requireAuthThen(() => confirm.mutate({ userId: session!.user.id, active: confirmed }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-3 font-display text-lg font-semibold">Status timeline</h2>
              <ol className="relative space-y-4 border-l border-border pl-4">
                {history?.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[21px] top-1 size-2.5 rounded-full ring-4 ring-surface" style={{ background: `var(--color-${STATUS_META[h.to_status].tone})` }} />
                    <p className="text-sm font-semibold">{STATUS_META[h.to_status].label}</p>
                    <p className="text-xs text-muted">{STATUS_META[h.to_status].description} · {timeAgo(h.created_at)}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function ValidationCard({ verdict, confidence, explanation, resolutionUrl }: {
  verdict: string
  confidence: number | null
  explanation: string | null
  resolutionUrl: string | null
}) {
  const genuine = verdict === 'genuine'
  const tone = genuine ? 'var(--color-status-resolved)' : 'var(--color-status-rejected)'
  return (
    <Card style={{ borderColor: `color-mix(in oklch, ${tone} 40%, transparent)` }}>
      <CardBody>
        <div className="flex items-center gap-2 font-semibold" style={{ color: tone }}>
          {genuine ? <ShieldCheck className="size-5" /> : <Sparkles className="size-5" />}
          AI fix verification: {verdict}
          {confidence != null ? <span className="font-mono text-xs">({Math.round(confidence * 100)}%)</span> : null}
        </div>
        {resolutionUrl ? (
          <img src={resolutionUrl} alt="Resolution proof" className="mt-3 aspect-video w-full rounded-xl object-cover" />
        ) : null}
        {explanation ? <p className="mt-2 text-sm text-ink-soft">{explanation}</p> : null}
      </CardBody>
    </Card>
  )
}
