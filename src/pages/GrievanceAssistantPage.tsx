import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, CheckCircle2, ChevronRight, LocateFixed, Mic, Send, Sparkles, Square, Volume2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCategories, useDepartments } from '@/features/issues/queries'
import { useCreatePublicGrievance } from '@/features/grievances/mutations'
import { extractFromText, type IssueAnalysis } from '@/lib/ai'
import { useGeolocation, DEFAULT_CENTER, type Coords } from '@/hooks/useGeolocation'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { reverseGeocode } from '@/lib/geocode'
import { detectLanguage } from '@/lib/language'
import { LocationPicker } from '@/components/map/LocationPicker'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ChannelAccess } from '@/components/grievance/ChannelAccess'
import { FieldError, Input, Label, Textarea } from '@/components/ui/Field'
import type { AppLanguage } from '@/lib/issues'

type VoiceLanguage = AppLanguage | 'mr' | 'bn' | 'ta' | 'te' | 'kn' | 'ml'
type IntakeLanguage = VoiceLanguage | 'auto'

const languages: Array<{ value: VoiceLanguage; label: string; speechLocale: string }> = [
  { value: 'en', label: 'English', speechLocale: 'en-IN' },
  { value: 'hi', label: 'हिन्दी', speechLocale: 'hi-IN' },
  { value: 'gu', label: 'ગુજરાતી', speechLocale: 'gu-IN' },
  { value: 'mr', label: 'मराठी', speechLocale: 'mr-IN' },
  { value: 'bn', label: 'বাংলা', speechLocale: 'bn-IN' },
  { value: 'ta', label: 'தமிழ்', speechLocale: 'ta-IN' },
  { value: 'te', label: 'తెలుగు', speechLocale: 'te-IN' },
  { value: 'kn', label: 'ಕನ್ನಡ', speechLocale: 'kn-IN' },
  { value: 'ml', label: 'മലയാളം', speechLocale: 'ml-IN' },
]

const minimumAutoFillConfidence = 0.72

export function GrievanceAssistantPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data: categories = [] } = useCategories()
  const { data: departments = [] } = useDepartments()
  const { coords: browserCoords, locate } = useGeolocation()
  const speech = useSpeechRecognition()
  const create = useCreatePublicGrievance()

  const [language, setLanguage] = useState<IntakeLanguage>('auto')
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [severity, setSeverity] = useState(5)
  const [coords, setCoords] = useState<Coords>(DEFAULT_CENTER)
  const [address, setAddress] = useState<string | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [assistantReply, setAssistantReply] = useState('Describe the problem in your own words. AI will suggest the service area, responsible department and urgency for you to review.')
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])
  const [analysisConfidence, setAnalysisConfidence] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ issueId: string; complaintNumber: string; referenceLabel: string } | null>(null)

  const selectedCategory = useMemo(() => categories.find((item) => item.id === categoryId), [categories, categoryId])
  const detectedLanguage = useMemo(() => detectLanguage(message), [message])
  const activeLanguage = language === 'auto' ? detectedLanguage.replyLanguage : language

  useEffect(() => { locate() }, [locate])
  // Geolocation is an external event; copy its result into the editable map state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (browserCoords) setCoords(browserCoords) }, [browserCoords])
  useEffect(() => {
    let cancelled = false
    void reverseGeocode(coords.lat, coords.lng).then((value) => {
      if (!cancelled) setAddress(value)
    })
    return () => { cancelled = true }
  }, [coords])
  useEffect(() => {
    if (speech.transcript) {
      // Speech recognition delivers external input that must update the form field.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessage(speech.transcript)
    }
  }, [speech.transcript])
  useEffect(() => {
    if (selectedCategory?.default_department_id) {
      // Selecting a category intentionally updates the dependent department field.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDepartmentId(selectedCategory.default_department_id)
    }
  }, [selectedCategory?.default_department_id])

  function applyAnalysis(result: IssueAnalysis) {
    const confidence = result.confidence ?? 0
    setAnalysisConfidence(confidence)
    setClarificationQuestions(result.clarificationQuestions ?? [])
    setAssistantReply(result.assistantReply || (confidence < minimumAutoFillConfidence
      ? 'I am not confident enough to fill the form for you. Please answer the questions below or fill the details yourself.'
      : 'I prepared suggestions from your description. Please review each field before lodging.'))
    if (confidence < minimumAutoFillConfidence) return
    const matchingCategory = categories.find((item) => item.slug === result.categorySlug)
    if (matchingCategory) {
      setCategoryId(matchingCategory.id)
      setDepartmentId(matchingCategory.default_department_id)
    }
    const matchingDepartment = departments.find((item) => item.name.toLowerCase() === result.departmentName?.toLowerCase())
    if (matchingDepartment) setDepartmentId(matchingDepartment.id)
    setTitle(result.title)
    setMessage(result.description || message)
    setSeverity(result.severity)
  }

  async function understandGrievance() {
    if (!message.trim()) return
    setError(null)
    setAnalysing(true)
    try {
      applyAnalysis(await extractFromText({
        text: message,
        hintCategorySlugs: categories.map((item) => item.slug),
        replyLanguage: activeLanguage,
        detectedLanguages: detectedLanguage.languages,
      }))
    } catch {
      setError('AI analysis is unavailable right now. You can still choose the department and lodge your grievance manually.')
    } finally {
      setAnalysing(false)
    }
  }

  async function lodgeGrievance() {
    setError(null)
    if (!session) return setError('Please sign in to lodge and track your grievance.')
    if (!title.trim()) return setError('Add a short grievance title so the department can identify it quickly.')
    if (message.trim().length < 10) return setError('Please describe the grievance in a little more detail.')
    if (!categoryId) return setError('Choose the service area that best fits your grievance.')
    try {
      const result = await create.mutateAsync({
        title: title.trim(),
        description: message.trim(),
        categoryId,
        departmentId,
        severity,
        lat: coords.lat,
        lng: coords.lng,
        address,
        language: activeLanguage,
        aiMeta: { aiGenerated: analysing === false, intake: 'chat' },
      })
      setCreated({ issueId: result.issue_id, complaintNumber: result.complaint_number, referenceLabel: result.referenceLabel })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not lodge the grievance. Please try again.')
    }
  }

  function speakReply() {
    if (!assistantReply || !('speechSynthesis' in window)) return
    const selectedLanguage = languages.find((item) => item.value === activeLanguage)
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(assistantReply)
    utterance.lang = selectedLanguage?.speechLocale ?? 'en-IN'
    window.speechSynthesis.speak(utterance)
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Card className="border-status-resolved/35 bg-status-resolved/5">
          <CardBody className="text-center">
            <CheckCircle2 className="mx-auto size-12 text-status-resolved" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-status-resolved">Grievance lodged</p>
            <h1 className="mt-1 font-display text-3xl font-semibold">We have sent it to the right place.</h1>
            <p className="mt-4 text-sm text-muted">Keep this reference for tracking and conversations with the department.</p>
            <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-primary/25 bg-surface px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{created.referenceLabel}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Complaint number</p>
              <p className="mt-1 font-mono text-2xl font-bold text-primary">{created.complaintNumber}</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={() => navigate(`/issue/${created.issueId}`)}>Track this grievance <ChevronRight className="size-4" /></Button>
              <Button variant="outline" onClick={() => { setCreated(null); setTitle(''); setMessage(''); setCategoryId('') }}>Lodge another</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Report a grievance</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Describe it. We’ll find the department.</h1>
          <p className="mt-2 text-sm text-muted">Type or speak in English, हिन्दी, ગુજરાતી, मराठी, বাংলা, தமிழ் and more. A photo is optional for this route.</p>
        </div>
        <Bot className="mt-1 size-9 shrink-0 text-primary" />
      </div>

      <Card className="border-primary/30 bg-primary-tint/20">
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="mb-0" htmlFor="grievance-language">Language</Label>
            <select id="grievance-language" value={language} onChange={(event) => setLanguage(event.target.value as IntakeLanguage)} className="rounded-lg border border-border-strong bg-surface px-2 py-1 text-sm">
              <option value="auto">Auto-detect from my message</option>
              {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <Label className="mt-4" htmlFor="grievance-message">Describe your grievance</Label>
          <Textarea id="grievance-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="For example: I have been waiting two weeks for a birth certificate application update…" />
          <div className="mt-3 flex flex-wrap gap-2">
            {speech.supported ? (
              speech.listening
                ? <Button type="button" variant="danger" size="sm" onClick={speech.stop}><Square className="size-4" /> Stop voice input</Button>
                : <Button type="button" variant="outline" size="sm" onClick={() => speech.start(activeLanguage)}><Mic className="size-4" /> Voice input</Button>
            ) : <span className="self-center text-xs text-muted">Voice input works in Chrome and supported mobile browsers.</span>}
            <Button type="button" size="sm" loading={analysing} disabled={!message.trim()} onClick={understandGrievance}><Sparkles className="size-4" /> Understand with AI</Button>
          </div>
          {speech.listening ? <p className="mt-2 text-xs font-semibold text-primary">● Listening in {languages.find((item) => item.value === activeLanguage)?.label}…</p> : null}
          {speech.error ? <p className="mt-2 text-xs text-status-rejected">Voice input: {speech.error}</p> : null}
          {message.trim() ? <p className="mt-2 text-xs text-muted">{detectedLanguage.isMixed ? `Mixed language detected: ${detectedLanguage.languages.join(' + ')}. AI will reply in ${activeLanguage}.` : `Detected language: ${activeLanguage}.`}</p> : null}
          <div className="mt-4 rounded-xl border border-primary/20 bg-surface p-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Bot className="size-4" /> AI analysis</p>
              <Button type="button" variant="ghost" size="sm" onClick={speakReply}><Volume2 className="size-4" /> Read aloud</Button>
            </div>
            <p className="mt-2 text-sm text-ink-soft">{assistantReply}</p>
            {analysisConfidence != null ? <p className={`mt-2 text-xs font-semibold ${analysisConfidence >= minimumAutoFillConfidence ? 'text-status-validated' : 'text-status-progress'}`}>AI confidence: {Math.round(analysisConfidence * 100)}% {analysisConfidence >= minimumAutoFillConfidence ? '— suggestions filled for your review.' : '— details were left for you to confirm.'}</p> : null}
            {clarificationQuestions.length ? <div className="mt-3 rounded-lg bg-primary-tint/35 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Please clarify</p><ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-soft">{clarificationQuestions.map((question) => <li key={question}>{question}</li>)}</ul></div> : null}
          </div>
        </CardBody>
      </Card>
      <ChannelAccess />

      <Card className="mt-5">
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-2"><h2 className="font-display text-xl font-semibold">Review and lodge</h2><span className="text-xs text-muted">You can correct every AI suggestion.</span></div>
          <div><Label htmlFor="grievance-title">Title</Label><Input id="grievance-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short summary of your grievance" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="grievance-category">Service area</Label><select id="grievance-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm"><option value="">Choose a service area…</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div><Label htmlFor="grievance-department">Responsible department</Label><select id="grievance-department" value={departmentId ?? ''} onChange={(event) => setDepartmentId(event.target.value || null)} className="w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm"><option value="">Let the system route it</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          </div>
          <div><Label htmlFor="grievance-severity" hint={`${severity}/10`}>Urgency</Label><input id="grievance-severity" type="range" min="1" max="10" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} className="w-full accent-[var(--color-primary)]" /></div>
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardBody>
          <div className="flex items-center justify-between gap-2"><Label className="mb-0">Location</Label><Button type="button" variant="ghost" size="sm" onClick={locate}><LocateFixed className="size-4" /> Use my location</Button></div>
          <div className="mt-3 h-52 overflow-hidden rounded-xl border border-border"><LocationPicker value={coords} onChange={setCoords} className="size-full" /></div>
          <p className="mt-2 text-sm text-muted">{address ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}</p>
        </CardBody>
      </Card>

      {error ? <FieldError>{error}</FieldError> : null}
      {session ? (
        <Button className="mt-5 w-full" size="lg" loading={create.isPending} onClick={lodgeGrievance}><Send className="size-4" /> Review and lodge grievance</Button>
      ) : (
        <Button className="mt-5 w-full" size="lg" onClick={() => navigate('/auth')}>Sign in to lodge and track grievance <ChevronRight className="size-4" /></Button>
      )}
      <p className="mt-3 text-center text-xs text-muted">Already uploaded photo or video evidence? <Link to="/report" className="font-semibold text-primary hover:underline">Use the visual issue report</Link>.</p>
    </div>
  )
}
