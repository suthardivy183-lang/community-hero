import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Bot, CheckCircle2, ChevronRight, LocateFixed, Mic, Send, ShieldCheck, Square } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useMyGrievanceSummaries, type MyGrievanceSummary } from '@/features/grievances/queries'
import { useCreatePublicGrievance } from '@/features/grievances/mutations'
import { useCategories, useDepartments } from '@/features/issues/queries'
import { useSimilarIssues } from '@/features/issues/nearby'
import { extractFromText, type IssueAnalysis } from '@/lib/ai'
import { detectLanguage } from '@/lib/language'
import { STATUS_META, type AppLanguage } from '@/lib/issues'
import { timeAgo } from '@/lib/utils'
import { useGeolocation, DEFAULT_CENTER, type Coords } from '@/hooks/useGeolocation'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { reverseGeocode } from '@/lib/geocode'
import { LocationPicker } from '@/components/map/LocationPicker'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { FieldError, Input, Label, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { StatusBadge } from '@/components/issue/StatusBadge'

type ChatMessage = { id: string; sender: 'citizen' | 'assistant'; body: string }
type VoiceLanguage = AppLanguage | 'mr' | 'bn' | 'ta' | 'te' | 'kn' | 'ml'
type IntakeStage = 'idle' | 'clarifying' | 'review'

const minimumAutoFillConfidence = 0.72
const openingMessage: ChatMessage = {
  id: 'welcome',
  sender: 'assistant',
  body: 'Tell me what is happening. I can help you understand it, find similar reports, and prepare a grievance for your review. I can also explain the status of your existing complaints.',
}

function words(value: string) {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 2) ?? []
}

function matchingIssues(question: string, issues: MyGrievanceSummary[]) {
  const queryWords = words(question)
  return issues.map((issue) => {
    const haystack = `${issue.title ?? ''} ${issue.description ?? ''} ${issue.category_name ?? ''} ${issue.department_name ?? ''}`.toLowerCase()
    return { issue, score: queryWords.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0) }
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.issue)
}

function factualReply(question: string, issue: MyGrievanceSummary) {
  const meta = STATUS_META[issue.status]
  const department = issue.department_name ?? 'the responsible department'
  const created = issue.created_at ? ` It was submitted ${timeAgo(issue.created_at)}.` : ''
  if (/(why|route|department|handle)/.test(question.toLowerCase())) {
    return `“${issue.title ?? 'Your grievance'}” is routed to ${department}. Its recorded service area is ${issue.category_name ?? 'not yet classified'}.${created} I can only answer from your saved grievance records.`
  }
  if (/(next|what now|when)/.test(question.toLowerCase())) {
    return `“${issue.title ?? 'Your grievance'}” is currently ${meta.label}. ${meta.description}. ${department} is the responsible team.${created} I can only answer from your saved grievance records.`
  }
  return `Your complaint “${issue.title ?? 'Untitled grievance'}” is currently ${meta.label}. ${meta.description}. It is handled by ${department}.${created} I can only answer from your saved grievance records.`
}

function isStatusQuestion(question: string) {
  return /(status|update|what happened|what.*next|who.*handling|department|reopen|escalat|complaint|grievance)/i.test(question)
}

export function CommunityHeroAssistantPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data: issues = [], isLoading, isError } = useMyGrievanceSummaries(session?.user.id)
  const { data: categories = [] } = useCategories()
  const { data: departments = [] } = useDepartments()
  const { coords: browserCoords, locate } = useGeolocation()
  const speech = useSpeechRecognition()
  const create = useCreatePublicGrievance()
  const [searchParams, setSearchParams] = useSearchParams()
  const context = searchParams.get('context')
  const [selectedIssueId, setSelectedIssueId] = useState(searchParams.get('issue') ?? '')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([openingMessage])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [severity, setSeverity] = useState(5)
  const [coords, setCoords] = useState<Coords>(DEFAULT_CENTER)
  const [address, setAddress] = useState<string | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [analysisConfidence, setAnalysisConfidence] = useState<number | null>(null)
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [intakeStage, setIntakeStage] = useState<IntakeStage>('idle')
  const [intakeNarrative, setIntakeNarrative] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedIssue = useMemo(() => issues.find((issue) => issue.id === selectedIssueId) ?? null, [issues, selectedIssueId])
  const selectedCategory = useMemo(() => categories.find((category) => category.id === categoryId), [categories, categoryId])
  const detectedLanguage = useMemo(() => detectLanguage(draft), [draft])
  const activeLanguage: VoiceLanguage = detectedLanguage.replyLanguage as VoiceLanguage
  const aiReplyLanguage = detectedLanguage.isMixed ? `mixed:${detectedLanguage.languages.join('+')}` : activeLanguage
  const similar = useSimilarIssues({ coords, categoryId: categoryId || null, radiusM: 300 })

  useEffect(() => { locate() }, [locate])
  // Browser location is external input for the editable map value.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (browserCoords) setCoords(browserCoords) }, [browserCoords])
  useEffect(() => {
    let cancelled = false
    void reverseGeocode(coords.lat, coords.lng).then((value) => { if (!cancelled) setAddress(value) })
    return () => { cancelled = true }
  }, [coords])
  useEffect(() => {
    if (speech.transcript) {
      // Voice recognition is an external input source.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(speech.transcript)
    }
  }, [speech.transcript])
  useEffect(() => {
    if (selectedCategory?.default_department_id) {
      // The existing category routing supplies a reviewable department suggestion.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDepartmentId(selectedCategory.default_department_id)
    }
  }, [selectedCategory?.default_department_id])

  function chooseIssue(issueId: string) {
    setSelectedIssueId(issueId)
    setSearchParams(issueId ? { issue: issueId } : {})
  }

  function addAssistantReply(body: string) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), sender: 'assistant', body }])
  }

  function applyAnalysis(result: IssueAnalysis, sourceText: string) {
    const confidence = result.confidence ?? 0
    setAnalysisConfidence(confidence)
    setClarificationQuestions(result.clarificationQuestions ?? [])
    setIntakeNarrative(sourceText)
    if (confidence >= minimumAutoFillConfidence) {
      const category = categories.find((item) => item.slug === result.categorySlug)
      if (category) {
        setCategoryId(category.id)
        setDepartmentId(category.default_department_id)
      }
      const department = departments.find((item) => item.name.toLowerCase() === result.departmentName?.toLowerCase())
      if (department) setDepartmentId(department.id)
      setTitle(result.title)
      setDescription(result.description || sourceText)
      setSeverity(result.severity)
      setReviewOpen(true)
      setIntakeStage('review')
    } else {
      setIntakeStage('clarifying')
    }
    addAssistantReply(result.assistantReply || (confidence < minimumAutoFillConfidence
      ? 'I am not fully certain yet. Please answer the clarification questions, then I will prepare a review for you.'
      : 'I prepared a grievance draft using the existing CommunityHero categories and department routing. Please review it before reporting.'))
  }

  async function understandIssue(sourceText: string) {
    const trimmed = sourceText.trim()
    if (!trimmed) return
    setError(null)
    setAnalysing(true)
    try {
      applyAnalysis(await extractFromText({
        text: trimmed,
        hintCategorySlugs: categories.map((category) => category.slug),
        replyLanguage: aiReplyLanguage,
        detectedLanguages: detectedLanguage.languages,
      }), trimmed)
    } catch {
      setError('AI understanding is unavailable right now. You can still use the existing report flow.')
    } finally {
      setAnalysing(false)
    }
  }

  async function askClarification(answer: string) {
    const combined = `${intakeNarrative}\nAdditional detail: ${answer}`.trim()
    await understandIssue(combined)
  }

  function handoffEvidence() {
    navigate('/report?assistantEvidence=true')
  }

  async function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed) return
    setMessages((current) => [...current, { id: crypto.randomUUID(), sender: 'citizen', body: trimmed }])
    setDraft('')
    if (intakeStage === 'clarifying') {
      await askClarification(trimmed)
      return
    }
    if (!isStatusQuestion(trimmed)) {
      await understandIssue(trimmed)
      return
    }
    const matches = matchingIssues(trimmed, issues)
    const specificWords = words(trimmed).filter((word) => !['what', 'happened', 'complaint', 'grievance', 'status', 'update', 'this', 'that', 'who', 'handling', 'next', 'when', 'why', 'route', 'department'].includes(word))
    if (!issues.length) addAssistantReply('You have not submitted any grievances yet. I can help you prepare one now—describe the civic issue in your own words.')
    else if (selectedIssue && !specificWords.length) addAssistantReply(factualReply(trimmed, selectedIssue))
    else if (matches.length === 1) {
      chooseIssue(matches[0].id ?? '')
      addAssistantReply(factualReply(trimmed, matches[0]))
    } else if (matches.length > 1) addAssistantReply(`I found ${matches.length} possible grievances. Select one below so I can give you the correct status.`)
    else await understandIssue(trimmed)
  }

  async function confirmAndReport() {
    setError(null)
    if (!session) return setError('Please sign in before reporting a grievance.')
    if (!title.trim() || description.trim().length < 10 || !categoryId) return setError('Add a title, enough detail, and a service area before confirming.')
    try {
      const result = await create.mutateAsync({
        title: title.trim(), description: description.trim(), categoryId, departmentId, severity,
        lat: coords.lat, lng: coords.lng, address, language: activeLanguage,
        aiMeta: { assistant: true, confidence: analysisConfidence, intake: 'communityhero-assistant' },
      })
      addAssistantReply(`Your complaint ${result.complaint_number} has been submitted successfully. I can now explain its status whenever you ask.`)
      setReviewOpen(false)
      setIntakeStage('idle')
      chooseIssue(result.issue_id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not submit the grievance. Please try again.')
    }
  }

  if (isLoading) return <div className="grid h-[60vh] place-items-center"><Spinner /></div>
  if (isError) return <AssistantUnavailable />

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-fg"><Bot className="size-6" /></span>
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Civic intelligence</p><h1 className="font-display text-3xl font-semibold">CommunityHero Assistant</h1><p className="mt-1 text-sm text-muted">Describe a civic problem naturally, or ask about one of your saved grievances. AI suggestions always need your review.</p></div>
      </div>

      {context === 'map' ? <div className="mb-5 rounded-xl border border-primary/25 bg-primary-tint/25 p-3 text-sm text-ink-soft">Map context is active. Tell me what problem is near you and I will use your selected location to find similar reports.</div> : null}

      <Card className="border-primary/25"><CardBody>
        <label className="text-sm font-semibold" htmlFor="assistant-complaint">Complaint context</label>
        <select id="assistant-complaint" value={selectedIssueId} onChange={(event) => chooseIssue(event.target.value)} className="mt-2 w-full rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm"><option value="">Choose a complaint to discuss…</option>{issues.map((issue) => <option key={issue.id} value={issue.id ?? ''}>{issue.title ?? 'Untitled grievance'} — {STATUS_META[issue.status ?? 'reported'].label}</option>)}</select>
        {selectedIssue ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-sunk p-3"><div><p className="font-semibold">{selectedIssue.title}</p><p className="mt-0.5 text-xs text-muted">{selectedIssue.department_name ?? 'Department being assigned'} · {selectedIssue.category_name ?? 'Unclassified'}</p></div><StatusBadge status={selectedIssue.status ?? 'reported'} /><Link to={`/issue/${selectedIssue.id}`} className="text-xs font-semibold text-primary hover:underline">Open complaint</Link></div> : null}
      </CardBody></Card>

      <Card className="mt-5"><CardBody>
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1" aria-live="polite">{messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm ${message.sender === 'citizen' ? 'ml-auto bg-primary text-primary-fg' : 'bg-surface-sunk text-ink'}`}><p className="mb-1 flex items-center gap-1.5 text-xs font-semibold opacity-75">{message.sender === 'citizen' ? 'You' : <><Bot className="size-3.5" /> CommunityHero Assistant</>}</p>{message.body}</div>)}</div>
        <div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void ask('There is a huge pothole near Alkapuri Circle.')}>Report a problem</Button><Button type="button" size="sm" variant="outline" onClick={() => void ask('What happened to my pothole complaint?')}>Track my complaint</Button><Button type="button" size="sm" variant="outline" onClick={() => void ask('Who is handling this complaint?')}>Explain a status</Button></div>
        <Label className="mt-4" htmlFor="assistant-question">How can I help with your civic issue?</Label>
        <Textarea id="assistant-question" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(draft) } }} placeholder="For example: ગોત્રી રોડ પર પાણીની પાઇપ લીક થઈ ગઈ છે." className="min-h-20" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {speech.supported ? (speech.listening ? <Button type="button" variant="danger" size="sm" onClick={speech.stop}><Square className="size-4" /> Stop</Button> : <Button type="button" variant="outline" size="sm" onClick={() => speech.start(activeLanguage)}><Mic className="size-4" /> Voice</Button>) : <span className="text-xs text-muted">Voice input works in supported browsers.</span>}
          <Button type="button" loading={analysing} disabled={!draft.trim()} onClick={() => void ask(draft)}><Send className="size-4" /> Understand</Button>
          {speech.listening ? <span className="text-xs font-semibold text-primary">Listening…</span> : null}
          {!speech.listening && speech.transcript ? <span className="text-xs font-semibold text-primary">Transcribing…</span> : null}
          {analysing ? <span className="text-xs font-semibold text-primary">Understanding…</span> : null}
        </div>
        {speech.error ? <FieldError>{`Voice input: ${speech.error}`}</FieldError> : null}
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-primary hover:underline">Attach image, video, audio, or document<input type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={(event) => { if (event.target.files?.[0]) handoffEvidence(); event.currentTarget.value = '' }} /></label>
      </CardBody></Card>

      {intakeStage === 'clarifying' ? <Card className="mt-5 border-primary/25"><CardBody><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">One step at a time</p><h2 className="mt-1 font-display text-xl font-semibold">A little more detail will help</h2><p className="mt-1 text-sm text-muted">Reply in the conversation box; I will update the same draft rather than starting over.</p>{clarificationQuestions.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">{clarificationQuestions.map((question) => <li key={question}>{question}</li>)}</ul> : null}</CardBody></Card> : null}

      {reviewOpen ? <Card className="mt-5 border-primary/30"><CardBody className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">AI-generated review</p><h2 className="font-display text-2xl font-semibold">Review before reporting</h2><p className="mt-1 text-sm text-muted">This is a suggestion, not a submitted complaint.</p></div>{analysisConfidence != null ? <span className="rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary">AI confidence {Math.round(analysisConfidence * 100)}%</span> : null}</div>
        {clarificationQuestions.length ? <div className="rounded-xl bg-primary-tint/35 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Please clarify if you can</p><ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-soft">{clarificationQuestions.map((question) => <li key={question}>{question}</li>)}</ul></div> : null}
        <div><Label htmlFor="assistant-title">Title</Label><Input id="assistant-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div><Label htmlFor="assistant-description">Description</Label><Textarea id="assistant-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="assistant-category">Service area</Label><select id="assistant-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm"><option value="">Choose a service area…</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div><Label htmlFor="assistant-department">Responsible department</Label><select id="assistant-department" value={departmentId ?? ''} onChange={(event) => setDepartmentId(event.target.value || null)} className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm"><option value="">Let the system route it</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div></div>
        <div><Label htmlFor="assistant-severity" hint={`${severity}/10`}>Suggested priority</Label><input id="assistant-severity" type="range" min="1" max="10" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} className="w-full accent-[var(--color-primary)]" /></div>
        <div><div className="flex items-center justify-between gap-2"><Label className="mb-0">Location</Label><Button type="button" variant="ghost" size="sm" onClick={locate}><LocateFixed className="size-4" /> Use my location</Button></div><div className="mt-3 h-52 overflow-hidden rounded-xl border border-border"><LocationPicker value={coords} onChange={setCoords} className="size-full" /></div><p className="mt-2 text-sm text-muted">{address ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}</p></div>
        {similar.data?.length ? <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-3"><p className="font-semibold">{similar.data.length} possible similar active reports nearby</p>{similar.data.slice(0, 3).map((issue) => <div key={issue.id} className="mt-2 flex items-center justify-between gap-2 text-sm"><span>{issue.title} · {Math.round(issue.distance_m)}m away</span><Link to={`/issue/${issue.id}`} className="font-semibold text-primary hover:underline">Support existing complaint</Link></div>)}<Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setReviewOpen(true)}>Create new report</Button></div> : null}
        <div className="flex flex-wrap gap-2"><Button type="button" loading={create.isPending} onClick={() => void confirmAndReport()}><CheckCircle2 className="size-4" /> Confirm & Report</Button><Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>Keep editing later</Button></div>
      </CardBody></Card> : null}

      {error ? <FieldError>{error}</FieldError> : null}
      <div className="mt-5 flex gap-3 rounded-xl border border-status-verified/25 bg-status-verified/5 p-3 text-sm text-ink-soft"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-status-verified" /><p>The assistant suggests and explains. CommunityHero’s established grievance workflow remains the source of truth, and nothing is submitted without your confirmation.</p></div>
    </div>
  )
}

function AssistantUnavailable() {
  return <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6"><Card className="border-status-warning/30"><CardBody><h1 className="font-display text-2xl font-semibold">CommunityHero Assistant is being connected</h1><p className="mt-2 text-sm text-muted">We could not retrieve your saved grievances right now. Your complaints have not been changed.</p><Link to="/grievance" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Report a new grievance <ChevronRight className="size-4" /></Link></CardBody></Card></div>
}
