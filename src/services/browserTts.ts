/**
 * Browser TTS Service - Web Speech API integration
 * Provides text-to-speech using the browser's built-in speech synthesis
 * with support for Chinese radical pronunciation mapping
 */

/**
 * Mapping of variant radicals to their pronounceable full forms
 * Some radicals are just component variants that don't have standalone pronunciation
 */
const RADICAL_TO_FULL_CHAR: Record<string, string> = {
  // Person variants
  '亻': '人', // rén - person radical
  // Heart variants
  '忄': '心', // xīn - heart radical
  // Hand variants
  '扌': '手', // shǒu - hand radical
  // Roof radical (doesn't pronounce well alone)
  '宀': '绵', // mián - roof radical, use 绵 for clearer pronunciation
  // Sickness radical
  '疒': '病', // bìng - sickness radical, use 病 for clearer pronunciation
  // Cave radical
  '穴': '穴', // xué - cave (keep as is, but ensure it's in mapping)
  // Wide radical
  '广': '广', // guǎng - wide
  // Water variants
  '氵': '水', // shuǐ - water radical
  // Fire variants
  '灬': '火', // huǒ - fire radical
  // Silk variants
  '纟': '丝', // sī - silk radical (simplified)
  '糸': '丝', // mì - silk
  // Grass variant
  '艹': '草', // cǎo - grass radical
  // Knife variants
  '刂': '刀', // dāo - knife radical
  // Spirit/altar variants
  '礻': '示', // shì - spirit radical
  // Clothes variants
  '衤': '衣', // yī - clothes radical
  // Speech variants
  '讠': '言', // yán - speech radical (simplified)
  // Food variants
  '饣': '食', // shí - food radical (simplified)
  // Metal variants
  '钅': '金', // jīn - metal radical (simplified)
  // Horse variant
  '马': '马', // mǎ - horse (pronounceable as is)
  // Door variant
  '门': '门', // mén - door (pronounceable as is)
  // Fish variant (simplified)
  '鱼': '鱼', // yú - fish
  // Bird variant (simplified)
  '鸟': '鸟', // niǎo - bird
  // Wind variant (simplified)
  '风': '风', // fēng - wind
  // Cloud variant (simplified)
  '云': '云', // yún - cloud
  // Vehicle variant (simplified)
  '车': '车', // chē - vehicle
  // See variant (simplified)
  '见': '见', // jiàn - see
};

/**
 * Browser TTS configuration
 */
export interface BrowserTTSConfig {
  lang?: string;
  rate?: number; // 0.1 - 10.0, default 1.0
  pitch?: number; // 0 - 2.0, default 1.0
  volume?: number; // 0 - 1.0, default 1.0
  voiceName?: string; // Preferred voice name
}

// Cache for voices to reduce lookup time
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;

/**
 * Initialize and cache available voices
 */
function initVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return;
  }

  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      voicesLoaded = true;
    }
  };

  // Try immediately
  loadVoices();

  // Also listen for voices changed event
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Initialize on module load (browser environment)
if (typeof window !== 'undefined') {
  initVoices();
}

/**
 * Check if speech synthesis is supported in the browser
 */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Get available speech synthesis voices
 */
export async function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) {
    return [];
  }

  // Return cached voices if already loaded
  if (voicesLoaded && cachedVoices.length > 0) {
    return cachedVoices;
  }

  // Wait for voices to load
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      voicesLoaded = true;
      resolve(voices);
      return;
    }

    // Listen for voices to become available
    const onVoicesChanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      resolve(cachedVoices);
    };

    window.speechSynthesis.onvoiceschanged = onVoicesChanged;

    // Fallback timeout
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      resolve(cachedVoices);
    }, 500);
  });
}

/**
 * Find the best voice for a given language
 */
function findVoiceForLanguage(
  lang: string,
  preferredVoiceName?: string
): SpeechSynthesisVoice | null {
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }

  // If a preferred voice name is specified, try to find it
  if (preferredVoiceName) {
    const preferred = cachedVoices.find(
      (voice) =>
        voice.name.toLowerCase().includes(preferredVoiceName.toLowerCase()) &&
        (voice.lang.startsWith(lang) || lang === '')
    );
    if (preferred) return preferred;
  }

  // Find voice by language
  const langNormalized = lang.toLowerCase();
  const langPrefix = langNormalized.split('-')[0];

  // Exact match first
  let voice = cachedVoices.find(
    (v) => v.lang.toLowerCase() === langNormalized
  );
  if (voice) return voice;

  // Prefix match
  voice = cachedVoices.find((v) =>
    v.lang.toLowerCase().startsWith(langPrefix)
  );
  if (voice) return voice;

  // For Chinese, try additional patterns
  if (langPrefix === 'zh') {
    voice = cachedVoices.find(
      (v) =>
        v.lang.includes('CN') ||
        v.name.toLowerCase().includes('chinese') ||
        v.name.toLowerCase().includes('mandarin')
    );
    if (voice) return voice;
  }

  return null;
}

/**
 * Map variant radicals to their pronounceable forms (for Chinese text)
 */
export function getPronounceable(char: string): string {
  return RADICAL_TO_FULL_CHAR[char] || char;
}

/**
 * Speak text using the Web Speech API
 * @param text The text to speak
 * @param config Optional configuration for speech parameters
 * @returns Promise that resolves when speech completes or rejects on error
 */
export function speakText(
  text: string,
  config: BrowserTTSConfig = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isSpeechSupported()) {
      reject(new Error('Speech synthesis is not supported in this browser'));
      return;
    }

    if (!text || text.trim().length === 0) {
      resolve();
      return;
    }

    // Map variant radicals to pronounceable forms for Chinese
    let textToSpeak = text;
    const lang = config.lang || 'en-US';
    if (lang.startsWith('zh')) {
      textToSpeak = text
        .split('')
        .map((char) => RADICAL_TO_FULL_CHAR[char] || char)
        .join('');
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Small delay after cancel to ensure clean state
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      // Set language
      utterance.lang = lang;

      // Find appropriate voice
      const voice = findVoiceForLanguage(lang, config.voiceName);
      if (voice) {
        utterance.voice = voice;
      }

      // Apply configuration
      utterance.rate = config.rate ?? 1.0;
      utterance.pitch = config.pitch ?? 1.0;
      utterance.volume = config.volume ?? 1.0;

      // Event handlers
      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        // 'interrupted' is not a real error (happens when we cancel)
        if (event.error === 'interrupted' || event.error === 'canceled') {
          resolve();
        } else {
          reject(new Error(`Speech synthesis error: ${event.error}`));
        }
      };

      window.speechSynthesis.speak(utterance);
    }, 10);
  });
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if (isSpeechSupported() && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if speech is currently active
 */
export function isSpeaking(): boolean {
  return isSpeechSupported() && window.speechSynthesis.speaking;
}

/**
 * Warm up the speech synthesis engine to reduce first-speech latency
 */
export function warmUpSpeech(): void {
  if (!isSpeechSupported()) return;

  // Speak an empty utterance silently to wake up the engine
  const utterance = new SpeechSynthesisUtterance('');
  utterance.volume = 0;
  utterance.rate = 10; // Fast to complete quickly
  window.speechSynthesis.speak(utterance);
}

/**
 * Preload voices and warm up the speech engine
 */
export async function preloadBrowserTTS(): Promise<void> {
  await getAvailableVoices();
  warmUpSpeech();
}
