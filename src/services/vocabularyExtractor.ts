/**
 * Vocabulary Extraction Service
 * Extracts language learning vocabulary from scraped data
 * Supports Chinese character decomposition using IDS parser
 */

import type {
  VocabularyItem,
  CharacterBreakdown,
  LanguageLearningContent,
  SupportedLanguage,
  VocabularyExtractionConfig,
} from '../types/tutorial';
import { DEFAULT_VOCABULARY_CONFIG } from '../types/tutorial';
import {
  parseIDS,
  extractComponents,
  getIDSForCharacter,
  getComponentInfo,
  getVietnameseMeaning,
} from './ids';

/**
 * Regex patterns for language detection
 */
const LANGUAGE_PATTERNS = {
  // Chinese (CJK Unified Ideographs)
  zh: /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/,
  // Japanese (Hiragana + Katakana + some CJK)
  ja: /[\u3040-\u309f\u30a0-\u30ff]/,
  // Korean (Hangul)
  ko: /[\uac00-\ud7af\u1100-\u11ff]/,
  // Vietnamese (Latin with diacritics)
  vi: /[\u00c0-\u024f\u1e00-\u1eff]/,
} as const;

/**
 * Extended CJK detection including Extension blocks
 */
const CJK_EXTENDED_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]|[\ud840-\ud87f][\udc00-\udfff]/g;

/**
 * Detect the primary language of a text string
 * @param text - Text to analyze
 * @returns Detected language code
 *
 * @example
 * ```typescript
 * detectLanguage('hello world');       // 'en'
 * detectLanguage('chinese text');  // 'zh'
 * detectLanguage('mixed');      // 'zh' (Chinese takes priority)
 * ```
 */
export function detectLanguage(text: string): SupportedLanguage {
  if (!text || text.length === 0) return 'unknown';

  // Count matches for each language
  const counts: Record<SupportedLanguage, number> = {
    zh: 0,
    ja: 0,
    ko: 0,
    vi: 0,
    en: 0,
    unknown: 0,
  };

  // Check for CJK characters first (highest priority)
  const zhMatches = text.match(LANGUAGE_PATTERNS.zh);
  if (zhMatches) {
    counts.zh = zhMatches.length;
  }

  // Check for Japanese-specific characters
  const jaMatches = text.match(new RegExp(LANGUAGE_PATTERNS.ja.source, 'g'));
  if (jaMatches) {
    counts.ja = jaMatches.length;
  }

  // Check for Korean characters
  const koMatches = text.match(new RegExp(LANGUAGE_PATTERNS.ko.source, 'g'));
  if (koMatches) {
    counts.ko = koMatches.length;
  }

  // Check for Vietnamese diacritics
  const viMatches = text.match(new RegExp(LANGUAGE_PATTERNS.vi.source, 'g'));
  if (viMatches) {
    counts.vi = viMatches.length;
  }

  // Find language with most matches
  let maxLang: SupportedLanguage = 'en';
  let maxCount = 0;

  for (const [lang, count] of Object.entries(counts) as [SupportedLanguage, number][]) {
    if (count > maxCount) {
      maxCount = count;
      maxLang = lang;
    }
  }

  // If no special characters found, assume English
  if (maxCount === 0) {
    return 'en';
  }

  // Japanese text with CJK uses both, prioritize based on hiragana/katakana presence
  if (counts.ja > 0 && counts.zh > 0) {
    // If more Japanese-specific characters, it's Japanese
    if (counts.ja > counts.zh * 0.3) {
      return 'ja';
    }
  }

  return maxLang;
}

/**
 * Extract unique Chinese characters/terms from text
 * @param text - Text to extract from
 * @returns Array of unique Chinese characters
 *
 * @example
 * ```typescript
 * extractChineseTerms('price 50');
 * // Returns: ['a', 'fruit', 'price']
 * ```
 */
export function extractChineseTerms(text: string): string[] {
  if (!text) return [];

  const matches = text.match(CJK_EXTENDED_REGEX);
  if (!matches) return [];

  // Return unique characters
  return [...new Set(matches)];
}

/**
 * Extract vocabulary items from data records
 * Automatically detects language and extracts relevant terms
 *
 * @param data - Array of data records to analyze
 * @param targetLang - Optional target language override
 * @returns Array of vocabulary items
 *
 * @example
 * ```typescript
 * const data = [{ name: 'fruit', price: 5999 }];
 * const vocab = extractVocabulary(data);
 * // Returns: [{ term: 'fruit', definition: '' }, ...]
 * ```
 */
export function extractVocabulary(
  data: Record<string, unknown>[],
  targetLang?: SupportedLanguage
): VocabularyItem[] {
  if (!data || data.length === 0) return [];

  const allText: string[] = [];
  const vocabulary: VocabularyItem[] = [];
  const seenTerms = new Set<string>();

  // Collect all string values from data
  for (const item of data) {
    for (const value of Object.values(item)) {
      if (typeof value === 'string') {
        allText.push(value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects
        const stringified = JSON.stringify(value);
        allText.push(stringified);
      }
    }
  }

  const combinedText = allText.join(' ');
  const detectedLang = targetLang || detectLanguage(combinedText);

  // Extract based on detected language
  if (detectedLang === 'zh' || detectedLang === 'ja') {
    const terms = extractChineseTerms(combinedText);

    for (const term of terms) {
      if (!seenTerms.has(term)) {
        seenTerms.add(term);
        vocabulary.push({
          term,
          definition: getVietnameseMeaning(term) || '',
        });
      }
    }
  }

  return vocabulary;
}

/**
 * Enrich vocabulary items with IDS decomposition
 * Adds component breakdown for Chinese characters
 *
 * @param terms - Array of vocabulary items to enrich
 * @returns Promise resolving to enriched vocabulary items
 *
 * @example
 * ```typescript
 * const vocab = [{ term: 'rest', definition: 'rest' }];
 * const enriched = await enrichWithIDS(vocab);
 * // Returns: [{ term: 'rest', definition: 'rest', components: ['person', 'wood'] }]
 * ```
 */
export async function enrichWithIDS(terms: VocabularyItem[]): Promise<VocabularyItem[]> {
  const enriched: VocabularyItem[] = [];

  for (const item of terms) {
    const idsString = await getIDSForCharacter(item.term);

    if (idsString) {
      const tree = parseIDS(idsString);
      const components = extractComponents(tree);

      enriched.push({
        ...item,
        components: components.length > 0 ? components : undefined,
      });
    } else {
      enriched.push(item);
    }
  }

  return enriched;
}

/**
 * Generate detailed character breakdowns with component meanings
 *
 * @param characters - Array of Chinese characters to break down
 * @returns Promise resolving to character breakdowns
 *
 * @example
 * ```typescript
 * const breakdowns = await generateCharacterBreakdowns(['rest']);
 * // Returns: [{
 * //   character: 'rest',
 * //   components: ['person', 'wood'],
 * //   meanings: { en: 'person + tree', vi: 'person (radical) + tree, wood' }
 * // }]
 * ```
 */
export async function generateCharacterBreakdowns(
  characters: string[]
): Promise<CharacterBreakdown[]> {
  const breakdowns: CharacterBreakdown[] = [];

  for (const char of characters) {
    const idsString = await getIDSForCharacter(char);

    if (idsString) {
      const tree = parseIDS(idsString);
      const components = extractComponents(tree);

      // Get meanings for each component
      const meanings: Record<string, string> = {};
      const enMeanings: string[] = [];
      const viMeanings: string[] = [];

      for (const comp of components) {
        const info = await getComponentInfo(comp);
        if (info) {
          enMeanings.push(info.meaning);
          viMeanings.push(info.meaningVi || info.meaning);
        } else {
          enMeanings.push(comp);
          viMeanings.push(comp);
        }
      }

      meanings['en'] = enMeanings.join(' + ');
      meanings['vi'] = viMeanings.join(' + ');

      breakdowns.push({
        character: char,
        components,
        meanings,
      });
    }
  }

  return breakdowns;
}

/**
 * Extract complete language learning content from data
 * Main entry point for vocabulary extraction with full IDS enrichment
 *
 * @param data - Array of data records to analyze
 * @param config - Extraction configuration
 * @returns Promise resolving to language learning content
 *
 * @example
 * ```typescript
 * const data = [{ name: 'Apple Phone', price: 5999 }];
 * const content = await extractLanguageLearningContent(data);
 * // Returns: {
 * //   targetLanguage: 'zh',
 * //   vocabulary: [...],
 * //   characterBreakdowns: [...]
 * // }
 * ```
 */
export async function extractLanguageLearningContent(
  data: Record<string, unknown>[],
  config: Partial<VocabularyExtractionConfig> = {}
): Promise<LanguageLearningContent | null> {
  const mergedConfig: VocabularyExtractionConfig = {
    ...DEFAULT_VOCABULARY_CONFIG,
    ...config,
  };

  // Extract initial vocabulary
  let vocabulary = extractVocabulary(data, mergedConfig.targetLanguage);

  if (vocabulary.length === 0) {
    return null;
  }

  // Limit items
  vocabulary = vocabulary.slice(0, mergedConfig.maxItems);

  // Detect target language
  const allTerms = vocabulary.map((v) => v.term).join('');
  const targetLanguage = mergedConfig.targetLanguage || detectLanguage(allTerms);

  // Enrich with IDS if Chinese
  if (targetLanguage === 'zh' || targetLanguage === 'ja') {
    if (mergedConfig.includeBreakdowns) {
      vocabulary = await enrichWithIDS(vocabulary);
    }
  }

  // Generate character breakdowns
  let characterBreakdowns: CharacterBreakdown[] | undefined;
  if (mergedConfig.includeBreakdowns && (targetLanguage === 'zh' || targetLanguage === 'ja')) {
    const characters = vocabulary.map((v) => v.term);
    characterBreakdowns = await generateCharacterBreakdowns(characters);

    // Filter out empty breakdowns
    characterBreakdowns = characterBreakdowns.filter((b) => b.components.length > 0);
    if (characterBreakdowns.length === 0) {
      characterBreakdowns = undefined;
    }
  }

  return {
    targetLanguage,
    vocabulary,
    characterBreakdowns,
  };
}

/**
 * Quick check if data contains vocabulary-worthy content
 *
 * @param data - Array of data records to check
 * @returns True if vocabulary extraction would yield results
 */
export function hasExtractableVocabulary(data: Record<string, unknown>[]): boolean {
  if (!data || data.length === 0) return false;

  for (const item of data) {
    for (const value of Object.values(item)) {
      if (typeof value === 'string') {
        // Check for CJK content
        if (CJK_EXTENDED_REGEX.test(value)) {
          return true;
        }
      }
    }
  }

  return false;
}
