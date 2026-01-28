/**
 * Internationalization (i18n) support
 * FP-4: Multi-language support for generated content
 */

/**
 * Supported languages
 */
export type SupportedLanguage =
  | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'nl' | 'pl' | 'ru'
  | 'zh' | 'ja' | 'ko' | 'ar' | 'hi' | 'tr' | 'vi' | 'th' | 'id'
  | 'sv' | 'no' | 'da' | 'fi' | 'cs' | 'el' | 'he';

/**
 * Language metadata
 */
export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  rtl: boolean;
}

/**
 * All supported languages with metadata
 */
export const LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  en: { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  es: { code: 'es', name: 'Spanish', nativeName: 'Espanol', rtl: false },
  fr: { code: 'fr', name: 'French', nativeName: 'Francais', rtl: false },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
  it: { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false },
  pt: { code: 'pt', name: 'Portuguese', nativeName: 'Portugues', rtl: false },
  nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false },
  pl: { code: 'pl', name: 'Polish', nativeName: 'Polski', rtl: false },
  ru: { code: 'ru', name: 'Russian', nativeName: 'Russkij', rtl: false },
  zh: { code: 'zh', name: 'Chinese', nativeName: 'Zhongwen', rtl: false },
  ja: { code: 'ja', name: 'Japanese', nativeName: 'Nihongo', rtl: false },
  ko: { code: 'ko', name: 'Korean', nativeName: 'Hangugeo', rtl: false },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'Arabiyya', rtl: true },
  hi: { code: 'hi', name: 'Hindi', nativeName: 'Hindi', rtl: false },
  tr: { code: 'tr', name: 'Turkish', nativeName: 'Turkce', rtl: false },
  vi: { code: 'vi', name: 'Vietnamese', nativeName: 'Tieng Viet', rtl: false },
  th: { code: 'th', name: 'Thai', nativeName: 'Phasa Thai', rtl: false },
  id: { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', rtl: false },
  sv: { code: 'sv', name: 'Swedish', nativeName: 'Svenska', rtl: false },
  no: { code: 'no', name: 'Norwegian', nativeName: 'Norsk', rtl: false },
  da: { code: 'da', name: 'Danish', nativeName: 'Dansk', rtl: false },
  fi: { code: 'fi', name: 'Finnish', nativeName: 'Suomi', rtl: false },
  cs: { code: 'cs', name: 'Czech', nativeName: 'Cestina', rtl: false },
  el: { code: 'el', name: 'Greek', nativeName: 'Ellinika', rtl: false },
  he: { code: 'he', name: 'Hebrew', nativeName: 'Ivrit', rtl: true },
};

/**
 * Translation keys for UI elements
 */
export type TranslationKey =
  | 'step'
  | 'steps'
  | 'click'
  | 'type'
  | 'scroll'
  | 'wait'
  | 'navigate'
  | 'target'
  | 'expectedResult'
  | 'note'
  | 'tip'
  | 'warning'
  | 'estimatedTime'
  | 'difficulty'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'tableOfContents'
  | 'summary'
  | 'generatedOn'
  | 'poweredBy'
  | 'tutorial'
  | 'minute'
  | 'minutes';

/**
 * English translations (base)
 */
const EN_TRANSLATIONS: Record<TranslationKey, string> = {
  step: 'Step',
  steps: 'Steps',
  click: 'Click',
  type: 'Type',
  scroll: 'Scroll',
  wait: 'Wait',
  navigate: 'Navigate',
  target: 'Target',
  expectedResult: 'Expected result',
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  estimatedTime: 'Estimated time',
  difficulty: 'Difficulty',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  tableOfContents: 'Table of Contents',
  summary: 'Summary',
  generatedOn: 'Generated on',
  poweredBy: 'Powered by',
  tutorial: 'Tutorial',
  minute: 'minute',
  minutes: 'minutes',
};

/**
 * Partial translations for other languages
 * In production, these would be complete or loaded dynamically
 */
const TRANSLATIONS: Partial<Record<SupportedLanguage, Partial<Record<TranslationKey, string>>>> = {
  es: {
    step: 'Paso',
    steps: 'Pasos',
    click: 'Clic',
    type: 'Escribir',
    scroll: 'Desplazar',
    wait: 'Esperar',
    navigate: 'Navegar',
    target: 'Objetivo',
    expectedResult: 'Resultado esperado',
    note: 'Nota',
    tip: 'Consejo',
    warning: 'Advertencia',
    estimatedTime: 'Tiempo estimado',
    difficulty: 'Dificultad',
    easy: 'Facil',
    medium: 'Medio',
    hard: 'Dificil',
    tableOfContents: 'Tabla de contenidos',
    summary: 'Resumen',
    generatedOn: 'Generado el',
    poweredBy: 'Desarrollado por',
    tutorial: 'Tutorial',
    minute: 'minuto',
    minutes: 'minutos',
  },
  fr: {
    step: 'Etape',
    steps: 'Etapes',
    click: 'Cliquer',
    type: 'Saisir',
    scroll: 'Defiler',
    wait: 'Attendre',
    navigate: 'Naviguer',
    target: 'Cible',
    expectedResult: 'Resultat attendu',
    note: 'Note',
    tip: 'Astuce',
    warning: 'Avertissement',
    estimatedTime: 'Temps estime',
    difficulty: 'Difficulte',
    easy: 'Facile',
    medium: 'Moyen',
    hard: 'Difficile',
    tableOfContents: 'Table des matieres',
    summary: 'Resume',
    generatedOn: 'Genere le',
    poweredBy: 'Propulse par',
    tutorial: 'Tutoriel',
    minute: 'minute',
    minutes: 'minutes',
  },
  de: {
    step: 'Schritt',
    steps: 'Schritte',
    click: 'Klicken',
    type: 'Eingeben',
    scroll: 'Scrollen',
    wait: 'Warten',
    navigate: 'Navigieren',
    target: 'Ziel',
    expectedResult: 'Erwartetes Ergebnis',
    note: 'Hinweis',
    tip: 'Tipp',
    warning: 'Warnung',
    estimatedTime: 'Geschatzte Zeit',
    difficulty: 'Schwierigkeit',
    easy: 'Einfach',
    medium: 'Mittel',
    hard: 'Schwer',
    tableOfContents: 'Inhaltsverzeichnis',
    summary: 'Zusammenfassung',
    generatedOn: 'Erstellt am',
    poweredBy: 'Unterstutzt von',
    tutorial: 'Anleitung',
    minute: 'Minute',
    minutes: 'Minuten',
  },
  zh: {
    step: 'Bu zhou',
    steps: 'Bu zhou',
    click: 'Dian ji',
    type: 'Shu ru',
    scroll: 'Gun dong',
    wait: 'Deng dai',
    navigate: 'Dao hang',
    target: 'Mu biao',
    expectedResult: 'Yu qi jie guo',
    note: 'Zhu yi',
    tip: 'Ti shi',
    warning: 'Jing gao',
    estimatedTime: 'Yu ji shi jian',
    difficulty: 'Nan du',
    easy: 'Jian dan',
    medium: 'Zhong deng',
    hard: 'Kun nan',
    tableOfContents: 'Mu lu',
    summary: 'Zong jie',
    generatedOn: 'Sheng cheng yu',
    poweredBy: 'You...ti gong zhi chi',
    tutorial: 'Jiao cheng',
    minute: 'fen zhong',
    minutes: 'fen zhong',
  },
  ja: {
    step: 'Suteppu',
    steps: 'Suteppu',
    click: 'Kurikku',
    type: 'Nyuryoku',
    scroll: 'Sukuroru',
    wait: 'Machi',
    navigate: 'Idou',
    target: 'Taagetto',
    expectedResult: 'Kitai sareru kekka',
    note: 'Chuui',
    tip: 'Hinto',
    warning: 'Keikoku',
    estimatedTime: 'Yosou jikan',
    difficulty: 'Nan-ido',
    easy: 'Kantan',
    medium: 'Futsu',
    hard: 'Muzukashii',
    tableOfContents: 'Mokuji',
    summary: 'Yoyaku',
    generatedOn: 'Sakusei bi',
    poweredBy: 'Teikyo',
    tutorial: 'Chuutoriaru',
    minute: 'fun',
    minutes: 'fun',
  },
};

/**
 * Get translation for a key in a specific language
 */
export function t(key: TranslationKey, language: SupportedLanguage = 'en'): string {
  const langTranslations = TRANSLATIONS[language];
  if (langTranslations && key in langTranslations) {
    return langTranslations[key] as string;
  }
  return EN_TRANSLATIONS[key];
}

/**
 * Get all translations for a language
 */
export function getTranslations(
  language: SupportedLanguage
): Record<TranslationKey, string> {
  return {
    ...EN_TRANSLATIONS,
    ...(TRANSLATIONS[language] || {}),
  };
}

/**
 * Check if a language is RTL
 */
export function isRTL(language: SupportedLanguage): boolean {
  return LANGUAGES[language]?.rtl || false;
}

/**
 * Get language info
 */
export function getLanguageInfo(language: SupportedLanguage): LanguageInfo | undefined {
  return LANGUAGES[language];
}

/**
 * Get list of all supported languages
 */
export function getSupportedLanguages(): LanguageInfo[] {
  return Object.values(LANGUAGES);
}

/**
 * Detect browser language and return closest supported language
 */
export function detectLanguage(): SupportedLanguage {
  const browserLang = navigator.language.split('-')[0] as SupportedLanguage;
  return LANGUAGES[browserLang] ? browserLang : 'en';
}

/**
 * LLM prompt suffix for generating content in a specific language
 */
export function getLanguagePromptSuffix(language: SupportedLanguage): string {
  if (language === 'en') {
    return '';
  }

  const info = LANGUAGES[language];
  if (!info) {
    return '';
  }

  return `\n\nIMPORTANT: Generate all output in ${info.name} (${info.nativeName}). Use natural, fluent ${info.name} appropriate for technical documentation.`;
}

/**
 * Format number for a locale
 */
export function formatNumber(num: number, language: SupportedLanguage): string {
  try {
    return new Intl.NumberFormat(language).format(num);
  } catch {
    return String(num);
  }
}

/**
 * Format date for a locale
 */
export function formatDate(date: Date | string, language: SupportedLanguage): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Format duration (e.g., "5 minutes")
 */
export function formatDuration(
  minutes: number,
  language: SupportedLanguage
): string {
  const unit = minutes === 1 ? t('minute', language) : t('minutes', language);
  return `${formatNumber(minutes, language)} ${unit}`;
}
