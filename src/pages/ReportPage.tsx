import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Sparkles, MapPin, Loader2, Users, Pencil, Video, ImagePlus, ShieldCheck, Link2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCategories } from '@/features/issues/queries'
import { useSimilarIssues } from '@/features/issues/nearby'
import { useCreateIssue } from '@/features/issues/mutations'
import { supabase } from '@/lib/supabase'
import { processMedia, type ProcessedMedia } from '@/lib/image'
import { analyzeReport, embedText, type IssueContext, type IssueAnalysis } from '@/lib/ai'
import { VoiceComplaint } from '@/components/report/VoiceComplaint'
import { fetchContext } from '@/lib/context'
import { reverseGeocode } from '@/lib/geocode'
import { useGeolocation, DEFAULT_CENTER, type Coords } from '@/hooks/useGeolocation'
import { LocationPicker } from '@/components/map/LocationPicker'
import { SeverityMeter } from '@/components/issue/SeverityMeter'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input, Textarea, Label, FieldError } from '@/components/ui/Field'
import { formatDistance } from '@/lib/utils'

export function ReportPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data: categories } = useCategories()
  const { coords: geoCoords, locate } = useGeolocation()
  const createIssue = useCreateIssue()

  const [media, setMedia] = useState<ProcessedMedia | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiUsed, setAiUsed] = useState(false)
  const [fillMode, setFillMode] = useState<'ai' | 'manual'>('ai')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [severity, setSeverity] = useState(5)
  const [severityScore, setSeverityScore] = useState<number | null>(null)
  const [severityFactors, setSeverityFactors] = useState<Record<string, number>>({})
  const [confidence, setConfidence] = useState<number | null>(null)
  const [departmentName, setDepartmentName] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [embedding, setEmbedding] = useState<number[]>([])

  const [coords, setCoords] = useState<Coords>(DEFAULT_CENTER)
  const [address, setAddress] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [context, setContext] = useState<IssueContext>({})
  const [error, setError] = useState<string | null>(null)
  const [demoSubmitted, setDemoSubmitted] = useState(false)
  const [incidentAnchorId, setIncidentAnchorId] = useState<string | null>(null)
  const [isConfidential, setIsConfidential] = useState(false)
  const [consentToShare, setConsentToShare] = useState(false)
  const photoCameraRef = useRef<HTMLInputElement>(null)
  const videoCameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => { locate() }, [locate])
  useEffect(() => { if (geoCoords) setCoords(geoCoords) }, [geoCoords])

  // Reverse-geocode + fetch civic context (hospital/school/road) whenever the pin moves.
  useEffect(() => {
    let cancelled = false
    setGeocoding(true)
    reverseGeocode(coords.lat, coords.lng).then((addr) => {
      if (!cancelled) { setAddress(addr); setGeocoding(false) }
    })
    fetchContext(coords.lat, coords.lng).then((ctx) => {
      if (!cancelled) setContext(ctx)
    })
    return () => { cancelled = true }
  }, [coords])

  const { data: similar } = useSimilarIssues({
    coords,
    categoryId: categoryId || null,
    embedding,
    imageHash: media?.imageHash,
  })

  async function analyzeMedia(processed: ProcessedMedia) {
    setAnalyzing(true)
    try {
      const slugs = (categories ?? []).map((c) => c.slug)
      const result = await analyzeReport({ imageBase64: processed.analysisBase64, mimeType: 'image/jpeg', hintCategorySlugs: slugs, context })
      applyAnalysis(result)
    } catch {
      setError('AI analysis is unavailable right now — please fill the details manually.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleFile(file: File) {
    setError(null)
    let processed: ProcessedMedia
    try {
      processed = await processMedia(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
      return
    }
    setMedia(processed)
    if (fillMode === 'ai') await analyzeMedia(processed)
  }

  function handleMediaSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void handleFile(file)
    event.target.value = ''
  }

  function applyAnalysis(result: IssueAnalysis) {
    const matched = categories?.find((c) => c.slug === result.categorySlug)
    if (matched) setCategoryId(matched.id)
    setTitle(result.title)
    setDescription(result.description)
    setSeverity(result.severity)
    setSeverityScore(result.severityScore ?? result.severity * 10)
    setSeverityFactors(result.severityFactors ?? {})
    setConfidence(result.confidence ?? null)
    if (result.departmentName) setDepartmentName(result.departmentName)
    setTags(result.tags)
    setAiUsed(true)
    embedText(`${result.title}. ${result.description}`).then(setEmbedding)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!media) return setError('Please add a photo or video of the issue.')
    if (!categoryId) return setError('Please choose a category.')
    if (!title.trim()) return setError('Please add a short title.')
    if (!session) {
      window.localStorage.setItem('communityhero-demo-report', JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        severity,
        address,
        createdAt: new Date().toISOString(),
      }))
      setDemoSubmitted(true)
      navigate('/profile')
      return
    }

    try {
      const id = await createIssue.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        severity,
        severityScore,
        severityFactors,
        nearHospital: context.nearHospital,
        nearSchool: context.nearSchool,
        roadClass: context.roadClass ?? null,
        embedding,
        imageHash: media.imageHash,
        lat: coords.lat,
        lng: coords.lng,
        address,
        tags,
        aiMeta: { aiGenerated: aiUsed, confidence, departmentName, tags },
        media: {
          uploadBlob: media.uploadBlob,
          mimeType: media.mimeType,
          ext: media.ext,
          kind: media.kind,
          posterBlob: media.posterBlob,
        },
        uploaderId: session.user.id,
        isConfidential,
        consentToShare,
      })
      let incidentGroupingUnavailable = false
      if (incidentAnchorId) {
        // This links two independently trackable reports to one underlying
        // infrastructure incident. It never merges away the citizen's record.
        const { error: incidentError } = await supabase.rpc('link_issue_to_infrastructure_incident', {
          p_issue_id: id,
          p_similar_issue_id: incidentAnchorId,
        })
        if (incidentError) {
          console.warn('Incident grouping is unavailable:', incidentError.message)
          incidentGroupingUnavailable = true
        }
      }
      navigate(`/issue/${id}${incidentGroupingUnavailable ? '?incidentGrouping=unavailable' : ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Report an issue</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Snap it. We'll handle the rest.</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-ink">How would you like to fill the report?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setFillMode('ai')} className={`rounded-xl border p-3 text-left transition-colors ${fillMode === 'ai' ? 'border-primary bg-primary-tint/40' : 'border-border hover:border-border-strong'}`}>
                <span className="flex items-center gap-2 font-semibold text-ink"><Sparkles className="size-4 text-primary" /> Let AI fill it</span>
                <span className="mt-1 block text-xs text-muted">AI suggests the category, description, and severity from your media.</span>
              </button>
              <button type="button" onClick={() => setFillMode('manual')} className={`rounded-xl border p-3 text-left transition-colors ${fillMode === 'manual' ? 'border-primary bg-primary-tint/40' : 'border-border hover:border-border-strong'}`}>
                <span className="flex items-center gap-2 font-semibold text-ink"><Pencil className="size-4 text-primary" /> I’ll fill it myself</span>
                <span className="mt-1 block text-xs text-muted">Upload evidence only; you control every report detail.</span>
              </button>
            </div>
          </CardBody>
        </Card>

        <Card className={isConfidential ? 'border-primary/40 bg-primary-tint/20' : undefined}>
          <CardBody>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1"><p className="font-semibold">Privacy controls</p><p className="mt-1 text-sm text-muted">Choose how this report appears outside the responsible department.</p></div>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:border-border-strong"><input type="checkbox" checked={isConfidential} onChange={(event) => setIsConfidential(event.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" /><span><span className="block text-sm font-semibold">Keep my identity private</span><span className="mt-0.5 block text-xs text-muted">Hide this complaint, its location, and your identity from public maps and transparency views. Only the assigned department can access it.</span></span></label>
            {!isConfidential ? <label className="mt-2 flex cursor-pointer items-start gap-3 px-3 py-2"><input type="checkbox" checked={consentToShare} onChange={(event) => setConsentToShare(event.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" /><span><span className="block text-sm font-medium">I consent to show this report publicly</span><span className="block text-xs text-muted">Your name is still not required for public problem tracking.</span></span></label> : null}
          </CardBody>
        </Card>

        {/* Photo */}
        <Card>
          <CardBody>
            <input ref={photoCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleMediaSelection} />
            <input ref={videoCameraRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleMediaSelection} />
            <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelection} />
            {media ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl">
                  {media.kind === 'video' ? (
                    <video src={media.previewUrl} controls playsInline className="aspect-video w-full bg-ink object-contain" />
                  ) : (
                    <img src={media.previewUrl} alt="Issue" className="aspect-video w-full object-cover" />
                  )}
                  {analyzing ? (
                    <div className="absolute inset-0 grid place-items-center bg-ink/55 text-white backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Loader2 className="size-5 animate-spin" /> AI is analysing the {media.kind}…
                      </div>
                    </div>
                  ) : null}
                </div>
                {fillMode === 'ai' && !aiUsed ? <Button type="button" variant="outline" size="sm" loading={analyzing} onClick={() => analyzeMedia(media)}><Sparkles className="size-4" /> Analyse with AI</Button> : null}
              </div>
            ) : (
              <div className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border-strong py-10 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-primary-tint text-primary">
                  <Camera className="size-6" />
                </span>
                <span className="font-semibold text-ink">Add a photo or video</span>
                <span className="text-sm text-muted">{fillMode === 'ai' ? 'AI can detect the category, write the report & score severity' : 'You can fill the title, category, description & severity yourself'}</span>
              </div>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Button type="button" onClick={() => photoCameraRef.current?.click()} disabled={analyzing}>
                <Camera className="size-4" /> Take photo
              </Button>
              <Button type="button" variant="outline" onClick={() => videoCameraRef.current?.click()} disabled={analyzing}>
                <Video className="size-4" /> Record video
              </Button>
              <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()} disabled={analyzing}>
                <ImagePlus className="size-4" /> Choose from gallery
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted">Camera options open the rear camera on supported phones.</p>
          </CardBody>
        </Card>

        <VoiceComplaint categorySlugs={(categories ?? []).map((c) => c.slug)} onExtract={applyAnalysis} />

        {aiUsed ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-status-validated/10 px-3.5 py-2 text-sm font-medium text-status-validated">
            <Sparkles className="size-4" /> AI pre-filled these details — edit anything that's off.
            {confidence != null ? (
              <span className="rounded-full bg-status-validated/15 px-2 py-0.5 text-xs font-bold">{Math.round(confidence * 100)}% confident</span>
            ) : null}
            {departmentName ? (
              <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary">→ {departmentName}</span>
            ) : null}
          </div>
        ) : null}

        {/* AI duplicate detection */}
        {similar && similar.length > 0 ? (
          <Card className="border-accent/40 bg-accent/5">
            <CardBody>
              <div className="mb-2 flex items-center gap-2 font-semibold text-accent-fg">
                <Users className="size-4" /> Similar issue already reported nearby
              </div>
              <p className="mb-3 text-sm text-ink-soft">
                Keep your own complaint number, while linking it to the same underlying infrastructure incident.
              </p>
              <div className="space-y-2">
                {similar.slice(0, 3).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setIncidentAnchorId((current) => current === n.id ? null : n.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-surface px-3 py-2 text-left transition-colors ${incidentAnchorId === n.id ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent'}`}
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted">
                        {Math.round(n.similarity)}% similar · {formatDistance(n.distance_m)} · {n.confirm_count ?? 0} supporters
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-fg">
                      <Link2 className="size-3.5" /> {incidentAnchorId === n.id ? 'Will group on submit' : 'Group after submit'}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">{incidentAnchorId ? 'Your submission will receive its own complaint number and be grouped with the selected incident.' : 'Not the same? Submit below to create a separate incident.'}</p>
            </CardBody>
          </Card>
        ) : null}

        {/* Details */}
        <Card>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deep pothole near the bus stop" />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="" disabled>Select a category…</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="description" hint="describe what you see">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label hint="how urgent / dangerous?">Severity</Label>
              <div className="flex items-center gap-4">
                <input type="range" min={1} max={10} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="flex-1 accent-[var(--color-primary)]" />
                <SeverityMeter severity={severity} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Location */}
        <Card>
          <CardBody>
            <Label>Location</Label>
            <div className="h-56 overflow-hidden rounded-xl border border-border">
              <LocationPicker value={coords} onChange={setCoords} className="h-full w-full" />
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              {geocoding ? 'Finding address…' : address ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
            </p>
            <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={locate}>
              Use my current location
            </Button>
          </CardBody>
        </Card>

        {error ? <FieldError>{error}</FieldError> : null}

        <Button type="submit" size="lg" className="w-full" loading={createIssue.isPending} disabled={demoSubmitted}>
          {demoSubmitted ? 'Report submitted (demo)' : 'Submit report'}
        </Button>
        {demoSubmitted ? <p className="text-center text-sm font-medium text-status-resolved">Thanks — your report was submitted in public demo mode.</p> : null}
      </form>
    </div>
  )
}
