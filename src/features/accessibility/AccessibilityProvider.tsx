import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Accessibility, RotateCcw } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

type AccessibilityPreferences = {
  largeText: boolean
  simpleLanguage: boolean
  lowBandwidth: boolean
}

type AccessibilityContextValue = AccessibilityPreferences & {
  setPreference: (key: keyof AccessibilityPreferences, value: boolean) => void
  reset: () => void
}

const defaults: AccessibilityPreferences = { largeText: false, simpleLanguage: false, lowBandwidth: false }
const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

function readPreferences(): AccessibilityPreferences {
  try {
    const saved = window.localStorage.getItem('communityhero-accessibility')
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults
  } catch { return defaults }
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(readPreferences)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.largeText = String(preferences.largeText)
    root.dataset.simpleLanguage = String(preferences.simpleLanguage)
    root.dataset.lowBandwidth = String(preferences.lowBandwidth)
    window.localStorage.setItem('communityhero-accessibility', JSON.stringify(preferences))
  }, [preferences])
  const value = useMemo<AccessibilityContextValue>(() => ({
    ...preferences,
    setPreference: (key, next) => setPreferences((current) => ({ ...current, [key]: next })),
    reset: () => setPreferences(defaults),
  }), [preferences])
  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>
}

export function useAccessibility() {
  const value = useContext(AccessibilityContext)
  if (!value) throw new Error('useAccessibility must be used inside AccessibilityProvider')
  return value
}

export function AccessibilityMenu() {
  const { largeText, simpleLanguage, lowBandwidth, setPreference, reset } = useAccessibility()
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-ink-soft transition-colors hover:border-border-strong" aria-label="Accessibility settings">
          <Accessibility className="size-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-72 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-pop)]">
          <p className="font-semibold">Accessibility</p>
          <p className="mt-1 text-xs text-muted">Settings are saved on this device.</p>
          <Toggle label="Large text" detail="Increase text size across the app." checked={largeText} onCheckedChange={(next) => setPreference('largeText', next)} />
          <Toggle label="Simple language" detail="Use shorter labels where available." checked={simpleLanguage} onCheckedChange={(next) => setPreference('simpleLanguage', next)} />
          <Toggle label="Low-bandwidth" detail="Avoid optional media loading and animations." checked={lowBandwidth} onCheckedChange={(next) => setPreference('lowBandwidth', next)} />
          <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><RotateCcw className="size-3.5" /> Reset settings</button>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function Toggle({ label, detail, checked, onCheckedChange }: { label: string; detail: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <label className="mt-3 flex cursor-pointer items-start justify-between gap-3 rounded-lg p-1.5 hover:bg-surface-sunk"><span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted">{detail}</span></span><input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} className="mt-1 size-4 accent-[var(--color-primary)]" /></label>
}
