import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bot, ChevronRight, Send, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useMyGrievanceSummaries, type MyGrievanceSummary } from '@/features/grievances/queries'
import { STATUS_META } from '@/lib/issues'
import { timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusBadge } from '@/components/issue/StatusBadge'

type ChatMessage = { id: string; sender: 'citizen' | 'assistant'; body: string }

const openingMessage: ChatMessage = {
  id: 'welcome',
  sender: 'assistant',
  body: 'I can help you understand the complaints you have already submitted. Ask about a status, department, or what happens next.',
}

function words(value: string) {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 2) ?? []
}

function matchingIssues(question: string, issues: MyGrievanceSummary[]) {
  const queryWords = words(question)
  const scored = issues.map((issue) => {
    const haystack = `${issue.title ?? ''} ${issue.description ?? ''} ${issue.category_name ?? ''} ${issue.department_name ?? ''}`.toLowerCase()
    const score = queryWords.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0)
    return { issue, score }
  }).filter((item) => item.score > 0)
  return scored.sort((a, b) => b.score - a.score).map((item) => item.issue)
}

function factualReply(question: string, issue: MyGrievanceSummary) {
  const status = issue.status
  const meta = STATUS_META[status]
  const department = issue.department_name ?? 'the responsible department'
  const created = issue.created_at ? ` It was submitted ${timeAgo(issue.created_at)}.` : ''
  const lower = question.toLowerCase()

  if (/(why|route|department|handle)/.test(lower)) {
    return `“${issue.title ?? 'Your grievance'}” is routed to ${department}. Its recorded service area is ${issue.category_name ?? 'not yet classified'}.${created} I can only answer from your saved grievance records.`
  }
  if (/(next|what now|when)/.test(lower)) {
    return `“${issue.title ?? 'Your grievance'}” is currently ${meta.label}. ${meta.description}. ${department} is the responsible team.${created} I can only answer from your saved grievance records.`
  }
  return `Your complaint “${issue.title ?? 'Untitled grievance'}” is currently ${meta.label}. ${meta.description}. It is handled by ${department}.${created} I can only answer from your saved grievance records.`
}

export function CommunityHeroAssistantPage() {
  const { session } = useAuth()
  const { data: issues = [], isLoading, isError } = useMyGrievanceSummaries(session?.user.id)
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedIssueId, setSelectedIssueId] = useState(searchParams.get('issue') ?? '')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([openingMessage])

  const selectedIssue = useMemo(() => issues.find((issue) => issue.id === selectedIssueId) ?? null, [issues, selectedIssueId])

  function chooseIssue(issueId: string) {
    setSelectedIssueId(issueId)
    setSearchParams(issueId ? { issue: issueId } : {})
  }

  function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed) return
    const citizenMessage: ChatMessage = { id: crypto.randomUUID(), sender: 'citizen', body: trimmed }
    const matches = matchingIssues(trimmed, issues)
    const specificWords = words(trimmed).filter((word) => !['what', 'happened', 'complaint', 'grievance', 'status', 'update', 'this', 'that', 'who', 'handling', 'next', 'when', 'why', 'route', 'department'].includes(word))
    let reply: string

    if (!issues.length) {
      reply = 'You have not submitted any grievances yet. Use Report a grievance to create one, then I can help you track it here.'
    } else if (selectedIssue && !specificWords.length) {
      reply = factualReply(trimmed, selectedIssue)
    } else if (matches.length === 1) {
      chooseIssue(matches[0].id ?? '')
      reply = factualReply(trimmed, matches[0])
    } else if (matches.length > 1) {
      reply = `I found ${matches.length} possible grievances. Select one below so I can give you the correct status.`
    } else {
      reply = 'I could not match that question to one of your saved grievances. Select a complaint below, then ask about its status, department, or next step.'
    }

    setMessages((current) => [...current, citizenMessage, { id: crypto.randomUUID(), sender: 'assistant', body: reply }])
    setDraft('')
  }

  if (isLoading) return <div className="grid h-[60vh] place-items-center"><Spinner /></div>

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Card className="border-status-warning/30">
          <CardBody>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-fg"><Bot className="size-6" /></span>
              <div>
                <h1 className="font-display text-2xl font-semibold">CommunityHero Assistant is being connected</h1>
                <p className="mt-2 text-sm text-muted">We could not retrieve your saved grievances right now. Please try again shortly. Your complaints have not been changed.</p>
                <Link to="/grievance" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Report a new grievance <ChevronRight className="size-4" /></Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-fg"><Bot className="size-6" /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Persistent citizen support</p>
          <h1 className="font-display text-3xl font-semibold">CommunityHero Assistant</h1>
          <p className="mt-1 text-sm text-muted">Ask about your existing grievances. Status answers are read from your saved records, never invented.</p>
        </div>
      </div>

      <Card className="border-primary/25">
        <CardBody>
          <label className="text-sm font-semibold" htmlFor="assistant-complaint">Complaint context</label>
          <select id="assistant-complaint" value={selectedIssueId} onChange={(event) => chooseIssue(event.target.value)} className="mt-2 w-full rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm">
            <option value="">Choose a complaint to discuss…</option>
            {issues.map((issue) => <option key={issue.id} value={issue.id ?? ''}>{issue.title ?? 'Untitled grievance'} — {STATUS_META[issue.status ?? 'reported'].label}</option>)}
          </select>
          {selectedIssue ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-sunk p-3"><div><p className="font-semibold">{selectedIssue.title}</p><p className="mt-0.5 text-xs text-muted">{selectedIssue.department_name ?? 'Department being assigned'} · {selectedIssue.category_name ?? 'Unclassified'}</p></div><StatusBadge status={selectedIssue.status ?? 'reported'} /><Link to={`/issue/${selectedIssue.id}`} className="text-xs font-semibold text-primary hover:underline">Open complaint</Link></div> : null}
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardBody>
          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1" aria-live="polite">
            {messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm ${message.sender === 'citizen' ? 'ml-auto bg-primary text-primary-fg' : 'bg-surface-sunk text-ink'}`}><p className="mb-1 flex items-center gap-1.5 text-xs font-semibold opacity-75">{message.sender === 'citizen' ? 'You' : <><Bot className="size-3.5" /> CommunityHero Assistant</>}</p>{message.body}</div>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => ask('What happened to my pothole complaint?')}>What happened to my pothole complaint?</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => ask('Who is handling this complaint?')}>Who is handling it?</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => ask('What happens next?')}>What happens next?</Button>
          </div>
          <div className="mt-4 flex gap-2"><Textarea id="assistant-question" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(draft) } }} placeholder="For example: What is happening with my water leakage complaint?" className="min-h-12" /><Button type="button" className="self-end" disabled={!draft.trim()} onClick={() => ask(draft)}><Send className="size-4" /> Ask</Button></div>
        </CardBody>
      </Card>

      <div className="mt-5 flex gap-3 rounded-xl border border-status-verified/25 bg-status-verified/5 p-3 text-sm text-ink-soft"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-status-verified" /><p>This assistant reads only your own grievances. For an official action such as reopening a completed complaint, use the action on that complaint’s detail page.</p></div>
      <Link to="/grievance" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Need to create a new complaint? Report a grievance <ChevronRight className="size-4" /></Link>
    </div>
  )
}
