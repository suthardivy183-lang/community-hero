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

// Many migrants use Gujarati orally but write it in English letters on phones.
// Require multiple high-signal words so ordinary English is not misclassified.
const transliteratedGujaratiMarkers = /\b(?:moto|khado|khada|padyo|padyu|padi|thay|thayu|thai|chhe|che|samne|ni|pase|marg|rasta|pani|gatar|light|sarkhu|karavo|karva|accident|thayo|thai gayu)\b/giu

export function detectTransliteratedGujarati(text: string): boolean {
  const matches = text.match(transliteratedGujaratiMarkers) ?? []
  return new Set(matches.map((match) => match.toLowerCase())).size >= 2
}

/** Detects Indian scripts plus Latin text. It is deliberately local so no citizen text is sent merely to choose a reply language. */
export function detectLanguage(text: string): LanguageDetection {
  const languages = scriptMatchers.filter(([, pattern]) => pattern.test(text)).map(([language]) => language)
  // Hindi and Marathi share Devanagari. Use conservative Marathi markers;
  // otherwise retain Hindi rather than guessing Marathi from the script alone.
  const devanagariIndex = languages.indexOf('hi')
  if (devanagariIndex >= 0 && /(?:^|[\s\p{P}])(आहे|आणि|माझा|माझी|माझे|कृपया|झाले|करा|करून)(?:$|[\s\p{P}])/u.test(text)) languages[devanagariIndex] = 'mr'
  if (detectTransliteratedGujarati(text)) languages.push('gu')
  else if (/[A-Za-z]/.test(text)) languages.push('en')
  const unique = [...new Set(languages)]
  return {
    languages: unique.length ? unique : ['en'],
    replyLanguage: unique[0] ?? 'en',
    isMixed: unique.length > 1,
  }
}
