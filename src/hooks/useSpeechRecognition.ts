import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not in lib.dom by default).
interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const LANG_MAP: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' }

interface SpeechState {
  supported: boolean
  listening: boolean
  transcript: string
  error: string | null
  start: (lang?: string) => void
  stop: () => void
  reset: () => void
}

/** Web Speech API wrapper for voice complaints (EN/HI/GU, free, in-browser). */
export function useSpeechRecognition(): SpeechState {
  const [supported] = useState(() => !!getCtor())
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback((lang = 'en') => {
    const Ctor = getCtor()
    if (!Ctor) {
      setError('Voice input is not supported in this browser.')
      return
    }
    const rec = new Ctor()
    rec.lang = LANG_MAP[lang] ?? 'en-IN'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setTranscript(text)
    }
    rec.onerror = (e) => { setError(e.error); setListening(false) }
    rec.onend = () => setListening(false)
    recRef.current = rec
    setError(null)
    setTranscript('')
    setListening(true)
    rec.start()
  }, [])

  useEffect(() => () => recRef.current?.stop(), [])

  return {
    supported,
    listening,
    transcript,
    error,
    start,
    stop,
    reset: () => setTranscript(''),
  }
}
