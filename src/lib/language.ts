export type DetectedLanguage = 'en' | 'hi' | 'gu' | 'mr' | 'bn' | 'ta' | 'te' | 'kn' | 'ml'

export interface LanguageDetection {
  languages: DetectedLanguage[]
  replyLanguage: DetectedLanguage
  isMixed: boolean
}

const scriptMatchers: Array<[DetectedLanguage, RegExp]> = [
  ['gu', /[\u0A80-\u0AFF]/u], ['hi', /[\u0900-\u097F]/u], ['bn', /[\u0980-\u09FF]/u],
  ['ta', /[\u0B80-\u0BFF]/u], ['te', /[\u0C00-\u0C7F]/u], ['kn', /[\u0C80-\u0CFF]/u],
  ['ml', /[\u0D00-\u0D7F]/u],
]

/** Detects Indian scripts plus Latin text. It is deliberately local so no citizen text is sent merely to choose a reply language. */
export function detectLanguage(text: string): LanguageDetection {
  const languages = scriptMatchers.filter(([, pattern]) => pattern.test(text)).map(([language]) => language)
  // Hindi and Marathi share Devanagari. Use conservative Marathi markers;
  // otherwise retain Hindi rather than guessing Marathi from the script alone.
  const devanagariIndex = languages.indexOf('hi')
  if (devanagariIndex >= 0 && /(?:^|[\s\p{P}])(आहे|आणि|माझा|माझी|माझे|कृपया|झाले|करा|करून)(?:$|[\s\p{P}])/u.test(text)) languages[devanagariIndex] = 'mr'
  if (/[A-Za-z]/.test(text)) languages.push('en')
  const unique = [...new Set(languages)]
  return {
    languages: unique.length ? unique : ['en'],
    replyLanguage: unique[0] ?? 'en',
    isMixed: unique.length > 1,
  }
}
