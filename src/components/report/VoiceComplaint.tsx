import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, Square, Loader2, Wand2 } from 'lucide-react'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { extractFromText, type IssueAnalysis } from '@/lib/ai'
import { LANGUAGE_LABELS, type AppLanguage } from '@/lib/issues'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface VoiceComplaintProps {
  categorySlugs: string[]
  onExtract: (result: IssueAnalysis) => void
}

/** Record a spoken complaint (EN/HI/GU), transcribe in-browser, extract fields. */
export function VoiceComplaint({ categorySlugs, onExtract }: VoiceComplaintProps) {
  const { i18n } = useTranslation()
  const { supported, listening, transcript, error, start, stop } = useSpeechRecognition()
  const [lang, setLang] = useState<AppLanguage>((i18n.language as AppLanguage) || 'en')
  const [extracting, setExtracting] = useState(false)

  if (!supported) return null

  async function useTranscript() {
    if (!transcript.trim()) return
    setExtracting(true)
    try {
      const result = await extractFromText({ text: transcript, hintCategorySlugs: categorySlugs })
      onExtract(result)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <Card className="border-primary/30 bg-primary-tint/20">
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold text-primary">
            <Mic className="size-4" /> Report by voice
          </h3>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as AppLanguage)}
            disabled={listening}
            className="rounded-lg border border-border-strong bg-surface px-2 py-1 text-xs font-medium focus:border-primary focus:outline-none"
          >
            {(Object.keys(LANGUAGE_LABELS) as AppLanguage[]).map((l) => (
              <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {listening ? (
            <Button type="button" variant="danger" size="sm" onClick={stop}>
              <Square className="size-4" /> Stop
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => start(lang)}>
              <Mic className="size-4" /> Start speaking
            </Button>
          )}
          <Button type="button" size="sm" onClick={useTranscript} disabled={!transcript.trim() || extracting}>
            {extracting ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            Fill from voice
          </Button>
        </div>

        {listening ? <p className="mt-2 text-xs font-medium text-primary">● Listening…</p> : null}
        {transcript ? <p className="mt-2 rounded-lg bg-surface p-2.5 text-sm text-ink-soft">{transcript}</p> : null}
        {error ? <p className="mt-1 text-xs text-status-rejected">Mic error: {error}</p> : null}
      </CardBody>
    </Card>
  )
}
