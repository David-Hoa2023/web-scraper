/**
 * LLM-Enhanced Data Analysis Service
 * Uses configured LLM provider to generate insights from scraped data
 */

import { getLLMGateway, type LLMProvider, type LLMRequestOptions } from './llmGateway';
import type { LanguageLearningContent } from '../types/tutorial';
import { extractLanguageLearningContent, hasExtractableVocabulary } from './vocabularyExtractor';

/**
 * Regex pattern to detect CJK (Chinese, Japanese, Korean) characters
 * Primarily used for Chinese character detection
 * Range: U+4E00 to U+9FFF (CJK Unified Ideographs)
 */
const CJK_REGEX = /[\u4e00-\u9fff]/;

/**
 * Extended CJK detection including Extension blocks
 * - CJK Unified Ideographs: U+4E00-U+9FFF
 * - CJK Extension A: U+3400-U+4DBF
 * - CJK Extension B-F: U+20000-U+2FA1F (surrogate pairs in JS)
 * - CJK Compatibility: U+F900-U+FAFF
 */
const CJK_EXTENDED_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]|[\ud840-\ud87f][\udc00-\udfff]/;

/**
 * Detect if data contains Chinese content
 * Useful for determining whether to apply Chinese-specific analysis or IDS parsing
 *
 * @param data - Array of data records to check
 * @returns True if any string value contains Chinese characters
 *
 * @example
 * ```typescript
 * const data = [{ name: '苹果手机', price: 5999 }];
 * if (detectChineseContent(data)) {
 *   // Enable Chinese character decomposition features
 * }
 * ```
 */
export function detectChineseContent(data: Record<string, unknown>[]): boolean {
  if (!data || data.length === 0) return false;

  for (const item of data) {
    for (const value of Object.values(item)) {
      if (typeof value === 'string' && CJK_REGEX.test(value)) {
        return true;
      }
      // Handle nested objects/arrays
      if (typeof value === 'object' && value !== null) {
        const stringified = JSON.stringify(value);
        if (CJK_REGEX.test(stringified)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Count Chinese characters in a string
 * @param text - Text to analyze
 * @returns Number of Chinese characters found
 */
export function countChineseCharacters(text: string): number {
  if (!text) return 0;
  const matches = text.match(new RegExp(CJK_REGEX.source, 'g'));
  return matches ? matches.length : 0;
}

/**
 * Extract unique Chinese characters from data
 * @param data - Array of data records
 * @returns Set of unique Chinese characters
 */
export function extractChineseCharacters(data: Record<string, unknown>[]): Set<string> {
  const characters = new Set<string>();

  for (const item of data) {
    for (const value of Object.values(item)) {
      if (typeof value === 'string') {
        const matches = value.match(new RegExp(CJK_EXTENDED_REGEX.source, 'g'));
        if (matches) {
          matches.forEach((char) => characters.add(char));
        }
      }
    }
  }

  return characters;
}

export interface LlmSettings {
  provider: '' | 'openai' | 'anthropic' | 'gemini' | 'deepseek';
  apiKey: string;
  model: string;
}

export interface DataAnalysisResult {
  insights: string[];
  recommendations: string[];
  summary: string;
  rawResponse?: string;
  /** Language learning content (vocabulary, character breakdowns) when Chinese content detected */
  languageLearning?: LanguageLearningContent;
}

/**
 * Load LLM settings from Chrome storage
 */
export async function loadLlmSettings(): Promise<LlmSettings | null> {
  try {
    const result = await chrome.storage.local.get('llmSettings');
    const stored = result.llmSettings;

    if (!stored || !stored.provider) {
      return null;
    }

    // Get API key for the current provider from apiKeys map
    let apiKey = stored.apiKey || '';
    if (stored.apiKeys && stored.provider && stored.apiKeys[stored.provider]) {
      apiKey = stored.apiKeys[stored.provider];
    }

    if (!apiKey) {
      console.log('[LLM Analysis] No API key for provider:', stored.provider);
      return null;
    }

    return {
      provider: stored.provider,
      apiKey,
      model: stored.model || '',
    };
  } catch (err) {
    console.error('[LLM Analysis] Failed to load settings:', err);
    return null;
  }
}

/**
 * Format data for LLM analysis prompt
 */
function formatDataForAnalysis(data: Array<Record<string, unknown>>, maxItems: number = 20): string {
  const sampleData = data.slice(0, maxItems);

  // Get field names from first item
  const fields = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

  // Format as a readable table-like structure
  let formatted = `Dataset contains ${data.length} items with fields: ${fields.join(', ')}\n\n`;
  formatted += 'Sample data (first ' + sampleData.length + ' items):\n';

  sampleData.forEach((item, idx) => {
    formatted += `\n[Item ${idx + 1}]\n`;
    for (const [key, value] of Object.entries(item)) {
      const displayValue = typeof value === 'string' ? value.substring(0, 100) : JSON.stringify(value);
      formatted += `  ${key}: ${displayValue}\n`;
    }
  });

  return formatted;
}

/**
 * Create analysis prompt for LLM
 */
function createAnalysisPrompt(data: Array<Record<string, unknown>>): string {
  const formattedData = formatDataForAnalysis(data);

  return `Analyze this scraped product/item data and provide insights.

${formattedData}

Please provide:
1. KEY INSIGHTS (3-5 bullet points about patterns, trends, or notable findings in the data)
2. RECOMMENDATIONS (2-3 actionable suggestions based on the data)
3. SUMMARY (1-2 sentences summarizing the overall dataset)

Format your response exactly like this:
INSIGHTS:
- [insight 1]
- [insight 2]
- [insight 3]

RECOMMENDATIONS:
- [recommendation 1]
- [recommendation 2]

SUMMARY:
[Your summary here]`;
}

/**
 * Parse LLM response into structured result
 */
function parseAnalysisResponse(response: string): DataAnalysisResult {
  const insights: string[] = [];
  const recommendations: string[] = [];
  let summary = '';

  // Parse insights
  const insightsMatch = response.match(/INSIGHTS:\s*([\s\S]*?)(?=RECOMMENDATIONS:|SUMMARY:|$)/i);
  if (insightsMatch) {
    const insightLines = insightsMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
    insights.push(...insightLines.map(line => line.replace(/^-\s*/, '').trim()).filter(Boolean));
  }

  // Parse recommendations
  const recsMatch = response.match(/RECOMMENDATIONS:\s*([\s\S]*?)(?=SUMMARY:|$)/i);
  if (recsMatch) {
    const recLines = recsMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
    recommendations.push(...recLines.map(line => line.replace(/^-\s*/, '').trim()).filter(Boolean));
  }

  // Parse summary
  const summaryMatch = response.match(/SUMMARY:\s*([\s\S]*?)$/i);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  }

  // Fallback if parsing failed
  if (insights.length === 0 && recommendations.length === 0 && !summary) {
    // Try to extract any bullet points as insights
    const bulletPoints = response.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      .map(line => line.replace(/^[-\d.]+\s*/, '').trim())
      .filter(Boolean);

    if (bulletPoints.length > 0) {
      insights.push(...bulletPoints.slice(0, 5));
    }
    summary = 'Analysis completed. See insights for details.';
  }

  return {
    insights,
    recommendations,
    summary,
    rawResponse: response,
  };
}

/**
 * Analyze scraped data using configured LLM
 */
export async function analyzeWithLLM(data: Array<Record<string, unknown>>): Promise<DataAnalysisResult | null> {
  // Load settings
  const settings = await loadLlmSettings();
  if (!settings) {
    console.log('[LLM Analysis] No LLM configured');
    return null;
  }

  if (data.length === 0) {
    return {
      insights: ['No data available for analysis'],
      recommendations: ['Scrape more data to get meaningful insights'],
      summary: 'The dataset is empty.',
    };
  }

  try {
    console.log(`[LLM Analysis] Analyzing ${data.length} items with ${settings.provider}/${settings.model}`);

    // Configure gateway with settings
    const gateway = getLLMGateway();
    gateway.setApiKey(settings.provider as LLMProvider, settings.apiKey);

    // Create prompt
    const prompt = createAnalysisPrompt(data);

    // Call LLM
    const options: LLMRequestOptions = {
      model: settings.model,
      maxTokens: 1024,
      temperature: 0.7,
      systemPrompt: 'You are a data analyst expert. Analyze the provided scraped data and provide concise, actionable insights. Be specific and reference actual values from the data.',
    };

    const response = await gateway.completeWith(settings.provider as LLMProvider, prompt, options);
    console.log('[LLM Analysis] Response received:', response.content.substring(0, 200) + '...');

    // Parse response
    const result = parseAnalysisResponse(response.content);

    // Extract vocabulary if Chinese content detected
    if (detectChineseContent(data) && hasExtractableVocabulary(data)) {
      console.log('[LLM Analysis] Chinese content detected, extracting vocabulary...');
      try {
        const languageLearning = await extractLanguageLearningContent(data, {
          includeBreakdowns: true,
          includePronunciation: true,
          maxItems: 50,
        });
        if (languageLearning) {
          result.languageLearning = languageLearning;
          console.log(
            `[LLM Analysis] Extracted ${languageLearning.vocabulary.length} vocabulary items`
          );
        }
      } catch (vocabErr) {
        console.warn('[LLM Analysis] Vocabulary extraction failed:', vocabErr);
        // Continue without vocabulary - don't fail the whole analysis
      }
    }

    return result;
  } catch (err) {
    console.error('[LLM Analysis] Error:', err);
    return {
      insights: [`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`],
      recommendations: ['Check your API key and try again'],
      summary: 'Unable to complete analysis due to an error.',
    };
  }
}

/**
 * Generate a quick summary of the data without full analysis
 */
export async function generateQuickSummary(data: Array<Record<string, unknown>>): Promise<string | null> {
  const settings = await loadLlmSettings();
  if (!settings) {
    return null;
  }

  try {
    const gateway = getLLMGateway();
    gateway.setApiKey(settings.provider as LLMProvider, settings.apiKey);

    const sampleData = data.slice(0, 10);
    const fields = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

    const prompt = `In 1-2 sentences, describe this dataset of ${data.length} items with fields: ${fields.join(', ')}. Sample item: ${JSON.stringify(sampleData[0])}`;

    const response = await gateway.completeWith(settings.provider as LLMProvider, prompt, {
      model: settings.model,
      maxTokens: 100,
      temperature: 0.5,
    });

    return response.content.trim();
  } catch {
    return null;
  }
}
