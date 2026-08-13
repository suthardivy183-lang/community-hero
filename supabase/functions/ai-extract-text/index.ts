import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { geminiJson, hasGemini } from '../_shared/gemini.ts'

const transliteratedGujaratiMarkers = /\b(?:moto|khado|khada|padyo|padyu|padi|thay|thayu|thai|chhe|che|samne|ni|pase|marg|rasta|pani|gatar|light|sarkhu|karavo|karva|accident|thayo|thai gayu)\b/giu

function detectTransliteratedGujarati(text: string): boolean {
  const matches = text.match(transliteratedGujaratiMarkers) ?? []
  return new Set(matches.map((match) => match.toLowerCase())).size >= 2
}

interface ExtractBody {
  text: string
  hintCategorySlugs: string[]
  replyLanguage?: string
  detectedLanguages?: string[]
  intakeStep?: 'initial' | 'followup'
}

const DEPARTMENTS: Record<string, string> = {
  pothole: 'Roads & Infrastructure', road_damage: 'Roads & Infrastructure', manhole: 'Roads & Infrastructure',
  water_leak: 'Water Supply & Drainage', drainage: 'Water Supply & Drainage', streetlight: 'Electricity & Streetlights',
  garbage: 'Sanitation & Waste', public_property: 'Parks & Public Spaces', tree: 'Parks & Public Spaces',
  'health-service-grievance': 'Health Services', 'education-service-grievance': 'Education Services',
  'public-transport-grievance': 'Public Transport', 'electricity-service-grievance': 'Electricity Services',
  'revenue-certificate-grievance': 'Revenue and Certificates', 'social-welfare-grievance': 'Social Welfare',
  'public-safety-grievance': 'Public Safety', other: 'General grievance cell',
}

const FALLBACK_COPY: Record<string, { reply: string; questions: string[] }> = {
  en: { reply: 'I need a little more detail before I can route this correctly.', questions: ['Which government service or department is this about?', 'What happened, and when did it start?'] },
  hi: { reply: 'सही विभाग तक भेजने के लिए मुझे थोड़ी और जानकारी चाहिए।', questions: ['यह किस सरकारी सेवा या विभाग से जुड़ा है?', 'क्या हुआ और यह कब शुरू हुआ?'] },
  gu: { reply: 'આ ફરિયાદ યોગ્ય વિભાગ સુધી મોકલવા માટે થોડી વધુ માહિતી જોઈએ.', questions: ['આ કઈ સરકારી સેવા અથવા વિભાગ વિશે છે?', 'શું થયું અને તે ક્યારે શરૂ થયું?'] },
  mr: { reply: 'ही तक्रार योग्य विभागाकडे पाठवण्यासाठी मला थोडी अधिक माहिती हवी आहे.', questions: ['ही कोणत्या सरकारी सेवा किंवा विभागाबद्दल आहे?', 'काय झाले आणि ते कधी सुरू झाले?'] },
  bn: { reply: 'সঠিক দপ্তরে পাঠাতে আমার আরও কিছু তথ্য দরকার।', questions: ['এটি কোন সরকারি পরিষেবা বা দপ্তর সম্পর্কিত?', 'কী ঘটেছে এবং কবে থেকে শুরু হয়েছে?'] },
  ta: { reply: 'சரியான துறைக்கு அனுப்ப இன்னும் சில விவரங்கள் தேவை.', questions: ['இது எந்த அரசு சேவை அல்லது துறையைப் பற்றியது?', 'என்ன நடந்தது, எப்போது தொடங்கியது?'] },
  te: { reply: 'సరైన శాఖకు పంపడానికి ఇంకొంత సమాచారం అవసరం.', questions: ['ఇది ఏ ప్రభుత్వ సేవ లేదా శాఖకు సంబంధించినది?', 'ఏమి జరిగింది, ఎప్పుడు ప్రారంభమైంది?'] },
  kn: { reply: 'ಸರಿಯಾದ ಇಲಾಖೆಗೆ ಕಳುಹಿಸಲು ಇನ್ನಷ್ಟು ಮಾಹಿತಿ ಬೇಕಾಗಿದೆ.', questions: ['ಇದು ಯಾವ ಸರ್ಕಾರಿ ಸೇವೆ ಅಥವಾ ಇಲಾಖೆಗೆ ಸಂಬಂಧಿಸಿದೆ?', 'ಏನಾಯಿತು ಮತ್ತು ಅದು ಯಾವಾಗ ಆರಂಭವಾಯಿತು?'] },
  ml: { reply: 'ശരിയായ വകുപ്പിലേക്ക് അയയ്ക്കാൻ കുറച്ച് കൂടുതൽ വിവരങ്ങൾ വേണം.', questions: ['ഇത് ഏത് സർക്കാർ സേവനമോ വകുപ്പിനെയോ കുറിച്ചാണ്?', 'എന്താണ് സംഭവിച്ചത്, എപ്പോഴാണ് ആരംഭിച്ചത്?'] },
  mixed: { reply: 'I need a little more detail / सही विभाग तक भेजने के लिए थोड़ी और जानकारी चाहिए।', questions: ['Which government service is this about? / यह किस सरकारी सेवा से जुड़ा है?', 'What happened and when? / क्या हुआ और कब शुरू हुआ?'] },
}

function clarificationCopy(replyLanguage: string) {
  if (replyLanguage.startsWith('mixed:')) {
    const languages = replyLanguage.slice(6).split('+').filter((language) => FALLBACK_COPY[language]).slice(0, 3)
    const copies = languages.map((language) => FALLBACK_COPY[language])
    if (copies.length) {
      return {
        reply: copies.map((copy) => copy.reply).join(' / '),
        questions: copies.map((copy) => copy.questions[0]).filter(Boolean).slice(0, 3),
      }
    }
  }
  return FALLBACK_COPY[replyLanguage] ?? FALLBACK_COPY.en
}

function detectLanguages(text: string) {
  const detected: string[] = []
  if (/[\u0A80-\u0AFF]/u.test(text)) detected.push('gu')
  if (/[\u0900-\u097F]/u.test(text)) detected.push(/(?:^|[\s\p{P}])(आहे|आणि|माझा|माझी|माझे|कृपया|झाले|करा|करून)(?:$|[\s\p{P}])/u.test(text) ? 'mr' : 'hi')
  if (/[\u0980-\u09FF]/u.test(text)) detected.push('bn')
  if (/[\u0B80-\u0BFF]/u.test(text)) detected.push('ta')
  if (/[\u0C00-\u0C7F]/u.test(text)) detected.push('te')
  if (/[\u0C80-\u0CFF]/u.test(text)) detected.push('kn')
  if (/[\u0D00-\u0D7F]/u.test(text)) detected.push('ml')
  if (detectTransliteratedGujarati(text)) detected.push('gu')
  else if (/[A-Za-z]/.test(text)) detected.push('en')
  return [...new Set(detected.length ? detected : ['en'])]
}

function fallback(text: string, hints: string[], languages: string[], replyLanguage: string) {
  const slug = hints[0] ?? 'other'
  const clean = text.trim()
  return {
    categorySlug: slug,
    title: clean.slice(0, 90) || 'Citizen grievance',
    description: clean || 'The citizen needs to provide more details for this grievance.',
    severity: 5,
    confidence: 0.5,
    departmentSlug: slug,
    departmentName: DEPARTMENTS[slug] ?? DEPARTMENTS.other,
    tags: ['needs-review'],
    detectedLanguages: languages,
    replyLanguage,
    assistantReply: clarificationCopy(replyLanguage).reply,
    clarificationQuestions: clarificationCopy(replyLanguage).questions,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  let body: ExtractBody
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const hints = Array.isArray(body.hintCategorySlugs) ? body.hintCategorySlugs : []
  const detectedLanguages = detectLanguages(text)
  const replyLanguage = typeof body.replyLanguage === 'string' ? body.replyLanguage : detectedLanguages[0]
  const intakeStep = body.intakeStep === 'followup' ? 'followup' : 'initial'
  if (!text) return json({ error: 'A grievance description is required' }, 400)
  if (!hasGemini()) return json(fallback(text, hints, detectedLanguages, replyLanguage))

  const isMixedReply = replyLanguage.startsWith('mixed:')
  const prompt = `You are an Indian public-service grievance intake assistant. The citizen may write in English, Hindi, Gujarati, Gujarati typed in English letters, or mixed Indian languages. Detected languages: ${detectedLanguages.join(', ')}. This is the ${intakeStep} intake step. ${isMixedReply ? `Reply naturally using the same language mix (${replyLanguage.slice(6)}); do not collapse it to just one language.` : `Reply in ${replyLanguage}.`} Preserve the citizen's facts. Use the citizen's same language style, including Gujarati written in English letters when that is how they wrote.
Allowed category slugs: ${hints.join(', ')}.
Citizen's message: ${text}
Return STRICT JSON with categorySlug (one allowed slug; use other only if allowed), title (under 100 chars), description (clear factual 2-3 sentences), severity (integer 1-10), confidence (0..1), tags (2-4 lowercase strings), detectedLanguages (array), replyLanguage, assistantReply (brief reply in the requested language), and clarificationQuestions (0-3 questions in the requested language). Ask only for information that is missing. For civic hazards, first ask for an exact location, landmark, or pincode only when it is not already known; then ask whether there is immediate danger or injury only when it is not already stated. Do not ask again for facts already stated. During the initial step, always ask at least one focused follow-up question before report review, even when confidence is high. If the location and safety facts are already clear, ask for one useful operational detail such as a nearby landmark, pincode, whether traffic is blocked, or whether the citizen can attach evidence. During a followup step, return an empty clarificationQuestions array only when the report has enough detail to prepare for review. If confidence is below 0.72, leave unclear fields conservative and use clarificationQuestions. Do not invent facts.`
  try {
    const raw = await geminiJson([{ text: prompt }])
    const allowed = new Set(hints)
    const categorySlug = typeof raw.categorySlug === 'string' && allowed.has(raw.categorySlug) ? raw.categorySlug : (hints[0] ?? 'other')
    const severity = Math.min(10, Math.max(1, Math.round(Number(raw.severity) || 5)))
    const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0.7))
    const clarificationQuestions = Array.isArray(raw.clarificationQuestions) ? raw.clarificationQuestions.map(String).slice(0, 3) : []
    const modelReply = typeof raw.assistantReply === 'string' ? raw.assistantReply.trim() : ''
    if ((intakeStep === 'initial' || confidence < 0.72) && clarificationQuestions.length === 0) {
      clarificationQuestions.push(...clarificationCopy(replyLanguage).questions)
    }
    return json({
      categorySlug,
      title: String(raw.title ?? text).slice(0, 120),
      description: String(raw.description ?? text).slice(0, 1500),
      severity,
      confidence,
      departmentSlug: categorySlug,
      departmentName: DEPARTMENTS[categorySlug] ?? DEPARTMENTS.other,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 4) : [],
      detectedLanguages: Array.isArray(raw.detectedLanguages) ? raw.detectedLanguages.map(String).slice(0, 4) : detectedLanguages,
      replyLanguage: typeof raw.replyLanguage === 'string' ? raw.replyLanguage : replyLanguage,
      assistantReply: modelReply || (intakeStep === 'initial' || confidence < 0.72 ? clarificationCopy(replyLanguage).reply : ''),
      clarificationQuestions,
    })
  } catch (error) {
    console.error('ai-extract-text fallback:', error)
    return json(fallback(text, hints, detectedLanguages, replyLanguage))
  }
})
