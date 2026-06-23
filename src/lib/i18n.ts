import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const en = {
  nav: { map: 'Map', dashboard: 'Dashboard', leaderboard: 'Leaderboard', report: 'Report', signin: 'Sign in', ranks: 'Ranks', me: 'Me' },
  home: {
    kicker: 'Live civic map',
    title: 'What needs fixing nearby',
    filter: 'Filter',
    allTypes: 'All types',
    anyStatus: 'Any status',
    nearMe: 'Near me',
    pins: 'Pins',
    heatmap: 'Heatmap',
    emptyTitle: 'No issues match your filters',
    emptyBody: 'Be the first Community Hero here — spot something broken? Snap a photo and let AI handle the rest.',
    reportCta: 'Report an issue',
  },
  stats: { reported: 'Reported', open: 'Open', resolved: 'Resolved' },
  report: { kicker: 'Report an issue', title: "Snap it. We'll handle the rest." },
}

const hi: typeof en = {
  nav: { map: 'नक्शा', dashboard: 'डैशबोर्ड', leaderboard: 'लीडरबोर्ड', report: 'रिपोर्ट', signin: 'साइन इन', ranks: 'रैंक', me: 'मैं' },
  home: {
    kicker: 'लाइव नागरिक नक्शा',
    title: 'आसपास क्या ठीक करना है',
    filter: 'फ़िल्टर',
    allTypes: 'सभी प्रकार',
    anyStatus: 'कोई भी स्थिति',
    nearMe: 'मेरे पास',
    pins: 'पिन',
    heatmap: 'हीटमैप',
    emptyTitle: 'आपके फ़िल्टर से कोई समस्या मेल नहीं खाती',
    emptyBody: 'यहाँ पहले कम्युनिटी हीरो बनें — कुछ टूटा दिखे? फ़ोटो खींचें और बाकी AI पर छोड़ दें।',
    reportCta: 'समस्या रिपोर्ट करें',
  },
  stats: { reported: 'रिपोर्ट किए गए', open: 'खुले', resolved: 'हल किए गए' },
  report: { kicker: 'समस्या रिपोर्ट करें', title: 'फ़ोटो खींचें. बाकी हम संभालेंगे.' },
}

const gu: typeof en = {
  nav: { map: 'નકશો', dashboard: 'ડેશબોર્ડ', leaderboard: 'લીડરબોર્ડ', report: 'રિપોર્ટ', signin: 'સાઇન ઇન', ranks: 'રેન્ક', me: 'હું' },
  home: {
    kicker: 'લાઇવ નાગરિક નકશો',
    title: 'નજીકમાં શું ઠીક કરવાનું છે',
    filter: 'ફિલ્ટર',
    allTypes: 'બધા પ્રકાર',
    anyStatus: 'કોઈપણ સ્થિતિ',
    nearMe: 'મારી નજીક',
    pins: 'પિન',
    heatmap: 'હીટમેપ',
    emptyTitle: 'તમારા ફિલ્ટર સાથે કોઈ સમસ્યા મેળ ખાતી નથી',
    emptyBody: 'અહીં પહેલા કમ્યુનિટી હીરો બનો — કંઈક તૂટેલું દેખાય? ફોટો લો અને બાકીનું AI સંભાળશે.',
    reportCta: 'સમસ્યા રિપોર્ટ કરો',
  },
  stats: { reported: 'રિપોર્ટ થયેલ', open: 'ખુલ્લા', resolved: 'ઉકેલાયેલ' },
  report: { kicker: 'સમસ્યા રિપોર્ટ કરો', title: 'ફોટો લો. બાકીનું અમે સંભાળીશું.' },
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, gu: { translation: gu } },
  lng: localStorage.getItem('ch-lang') ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lng: string) {
  void i18n.changeLanguage(lng)
  localStorage.setItem('ch-lang', lng)
}

export default i18n
