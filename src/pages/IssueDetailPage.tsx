import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MapPin, ArrowLeft, Send, ShieldCheck, Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react'
import {
  useIssue, useIssueMedia, useComments, useStatusHistory, useValidation, useFixFeedback, useCategories,
} from '@/features/issues/queries'
import { useMyInteractions } from '@/features/issues/userState'
import { useToggleVote, useToggleConfirm, useAddComment, useSubmitFixFeedback, useChangeStatus } from '@/features/issues/mutations'
import { useAuth } from '@/features/auth/AuthProvider'
import { mediaUrl, supabase } from '@/lib/supabase'
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
  const { data: fixFeedback } = useFixFeedback(id, session?.user.id)
  const { data: categories } = useCategories()
  const { data: interactions } = useMyInteractions(session?.user.id)

  const vote = useToggleVote(id ?? '')
  const confirm = useToggleConfirm(id ?? '')
  const addComment = useAddComment(id ?? '')
  const submitFixFeedback = useSubmitFixFeedback(id ?? '')
  const withdraw = useChangeStatus(id ?? '')
  const [comment, setComment] = useState('')
  const storedDemo = readDemoInteraction(id)
  const [demoVoted, setDemoVoted] = useState(storedDemo.voted)
  const [demoConfirmed, setDemoConfirmed] = useState(storedDemo.confirmed)
  const [demoComments, setDemoComments] = useState<Array<{ id: string; body: string }>>(storedDemo.comments)
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSeverity, setEditSeverity] = useState(5)
  const [editCategory, setEditCategory] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    if (!id || session) return
    window.localStorage.setItem(`communityhero-demo-interaction-${id}`, JSON.stringify({ voted: demoVoted, confirmed: demoConfirmed, comments: demoComments }))
  }, [id, session, demoVoted, demoConfirmed, demoComments])

  if (isLoading) return <div className="grid h-[60vh] place-items-center"><Spinner /></div>
  if (!issue) return <div className="mx-auto max-w-2xl px-4 py-10 text-center text-muted">Issue not found.</div>

  const voted = session ? (interactions?.votes.has(issue.id as string) ?? false) : demoVoted
  const confirmed = session ? (interactions?.confirmations.has(issue.id as string) ?? false) : demoConfirmed
  const originalMedia = media?.filter((item) => item.kind === 'original') ?? []
  const activeMedia = originalMedia.find((item) => item.id === selectedMediaId) ?? originalMedia[0]
  const activePoster = originalMedia.find((item) => item.type === 'photo')
  const resolution = media?.find((m) => m.kind === 'resolution')

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to map
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {/* Media */}
          {activeMedia?.type === 'video' ? (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-border shadow-[var(--shadow-card)]">
              <video src={mediaUrl(activeMedia.storage_path)} controls playsInline poster={activePoster ? mediaUrl(activePoster.storage_path) : undefined} className="aspect-video w-full bg-ink object-contain" />
            </div>
          ) : activeMedia?.type === 'photo' ? (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-border shadow-[var(--shadow-card)]">
              <img src={mediaUrl(activeMedia.storage_path)} alt={issue.title ?? ''} className="aspect-video w-full object-cover" />
            </div>
          ) : null}
          {originalMedia.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Issue media gallery">
              {originalMedia.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedMediaId(item.id)}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${activeMedia?.id === item.id ? 'border-primary' : 'border-border'}`}
                  aria-label={`View ${item.type}`}
                >
                  {item.type === 'photo' ? <img src={mediaUrl(item.storage_path)} alt="" className="size-full object-cover" /> : <video src={mediaUrl(item.storage_path)} muted playsInline className="size-full object-cover" />}
                  {item.type === 'video' ? <span className="absolute inset-0 grid place-items-center bg-ink/35 text-xs font-bold text-white">VIDEO</span> : null}
                </button>
              ))}
            </div>
          ) : null}

          {/* Title block */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-semibold text-primary">
                <CategoryIcon icon={issue.category_icon} className="size-3.5" /> {issue.category_name}
              </span>
              <StatusBadge status={issue.status ?? 'reported'} size="md" />
              {fixFeedback && fixFeedback.no >= 3 ? <span className="rounded-full bg-status-rejected/15 px-2.5 py-1 text-xs font-semibold text-status-rejected">Disputed by residents</span> : null}
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
            {session?.user.id === issue.reporter_id && issue.status === 'reported' ? (
              <div className="mt-4 rounded-xl border border-border bg-surface p-3">
                {!editing ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditTitle(issue.title ?? ''); setEditDescription(issue.description ?? ''); setEditSeverity(issue.severity ?? 5); setEditCategory(issue.category_id ?? ''); setEditing(true) }}>Edit report</Button><Button size="sm" variant="danger" loading={withdraw.isPending} onClick={() => withdraw.mutate({ status: 'rejected' })}>Withdraw</Button></div> : (
                  <div className="space-y-3">
                    <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm" aria-label="Report title" />
                    <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} className="min-h-24 w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm" aria-label="Report description" />
                    <select value={editCategory} onChange={(event) => setEditCategory(event.target.value)} className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm" aria-label="Report category">{categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
                    <label className="block text-sm font-medium">Severity {editSeverity}/10<input type="range" min="1" max="10" value={editSeverity} onChange={(event) => setEditSeverity(Number(event.target.value))} className="mt-2 w-full accent-[var(--color-primary)]" /></label>
                    <div className="flex gap-2"><Button size="sm" loading={editSaving} onClick={async () => { setEditSaving(true); const { error } = await supabase.from('issues').update({ title: editTitle.trim(), description: editDescription.trim(), severity: editSeverity, category_id: editCategory || issue.category_id }).eq('id', issue.id as string); setEditSaving(false); if (!error) setEditing(false) }}>Save changes</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div>
                  </div>
                )}
              </div>
            ) : null}
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

          {session && session.user.id !== issue.reporter_id && issue.status && ['resolved', 'ai_validated', 'closed'].includes(issue.status) ? (
            <Card className="border-primary/25 bg-primary-tint/20">
              <CardBody>
                <h2 className="font-display text-lg font-semibold">Was this actually fixed?</h2>
                <p className="mt-1 text-sm text-muted">Help your neighbours know whether the repair holds up.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={fixFeedback?.userVote != null || submitFixFeedback.isPending}
                    onClick={() => submitFixFeedback.mutate({ userId: session.user.id, satisfied: true })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-primary bg-surface px-3.5 font-semibold text-primary transition-all hover:bg-primary hover:text-primary-fg disabled:cursor-not-allowed disabled:opacity-60"
                  ><ThumbsUp className="size-4" /> Yes <span className="font-mono">{fixFeedback?.yes ?? 0}</span></button>
                  <button
                    type="button"
                    disabled={fixFeedback?.userVote != null || submitFixFeedback.isPending}
                    onClick={() => submitFixFeedback.mutate({ userId: session.user.id, satisfied: false })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-status-rejected bg-surface px-3.5 font-semibold text-status-rejected transition-all hover:bg-status-rejected hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  ><ThumbsDown className="size-4" /> Still broken <span className="font-mono">{fixFeedback?.no ?? 0}</span></button>
                  {fixFeedback?.userVote != null ? <span className="text-xs text-muted">Thanks for verifying this repair.</span> : null}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {/* Comments */}
          <Card>
            <CardBody>
              <h2 className="font-display text-lg font-semibold">Discussion</h2>
              <div className="mt-3 space-y-4">
                {(comments?.length || demoComments.length) ? <>
                {comments?.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={c.author?.full_name ?? null} url={c.author?.avatar_url ?? null} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><span className="font-semibold">{c.author?.full_name ?? 'Citizen'}</span> <span className="text-xs text-muted">· {timeAgo(c.created_at)}</span></p>
                      <p className="text-sm text-ink-soft">{c.body}</p>
                    </div>
                  </div>
                ))}
                {demoComments.map((demoComment) => (
                  <div key={demoComment.id} className="flex gap-3">
                    <Avatar name="Vadodara Citizen" url={null} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><span className="font-semibold">Vadodara Citizen</span> <span className="text-xs text-muted">· just now</span></p>
                      <p className="text-sm text-ink-soft">{demoComment.body}</p>
                    </div>
                  </div>
                ))}
                </> : <p className="text-sm text-muted">No comments yet — start the conversation.</p>}
              </div>
              <div className="mt-4 flex gap-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="min-h-11"
                />
                <Button
                  size="icon"
                  disabled={!comment.trim()}
                  loading={addComment.isPending}
                  onClick={() => session
                    ? addComment.mutate({ userId: session.user.id, body: comment.trim() }, { onSuccess: () => setComment('') })
                    : (setDemoComments((items) => [...items, { id: crypto.randomUUID(), body: comment.trim() }]), setComment(''))}
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
                voteCount={(issue.vote_count ?? 0) + (demoVoted ? 1 : 0)}
                confirmCount={(issue.confirm_count ?? 0) + (demoConfirmed ? 1 : 0)}
                voted={voted}
                confirmed={confirmed}
                confirmDisabled={!!session && session.user.id === issue.reporter_id}
                onVote={() => session
                  ? vote.mutate({ userId: session.user.id, active: voted })
                  : setDemoVoted((value) => !value)}
                onConfirm={() => session
                  ? confirm.mutate({ userId: session.user.id, active: confirmed })
                  : setDemoConfirmed((value) => !value)}
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

function readDemoInteraction(issueId: string | undefined): { voted: boolean; confirmed: boolean; comments: Array<{ id: string; body: string }> } {
  if (!issueId) return { voted: false, confirmed: false, comments: [] }
  try {
    const raw = window.localStorage.getItem(`communityhero-demo-interaction-${issueId}`)
    if (!raw) return { voted: false, confirmed: false, comments: [] }
    const data = JSON.parse(raw) as { voted?: unknown; confirmed?: unknown; comments?: unknown }
    return {
      voted: data.voted === true,
      confirmed: data.confirmed === true,
      comments: Array.isArray(data.comments)
        ? data.comments.filter((comment): comment is { id: string; body: string } => typeof comment?.id === 'string' && typeof comment?.body === 'string')
        : [],
    }
  } catch {
    return { voted: false, confirmed: false, comments: [] }
  }
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
