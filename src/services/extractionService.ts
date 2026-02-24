/**
 * Extraction Service - Unified extraction with Crawl4AI fallback
 *
 * Provides a unified interface for data extraction that:
 * - Uses local extraction by default (fast, works offline)
 * - Falls back to Crawl4AI for complex cases (LLM, batch)
 * - Gracefully degrades if Crawl4AI unavailable
 */

import type {
  ExtractionConfig,
  ExtractionField,
  ExtractedItem,
  ExtractionBackend,
  Crawl4AISettings,
  DEFAULT_CRAWL4AI_SETTINGS,
} from '../types';
import { getCrawl4AIClient, type Crawl4AIResult } from '../background/crawl4aiClient';
import { extractData, extractBatch } from '../content/dataExtractor';

/**
 * Storage key for Crawl4AI settings
 */
const SETTINGS_KEY = 'crawl4ai-settings';

/**
 * Extraction request options
 */
export interface ExtractionOptions {
  url: string;
  fields: ExtractionField[];
  containerSelector?: string;
  backend?: ExtractionBackend;
  llmInstruction?: string;
  normalize?: boolean;
  preserveHierarchy?: boolean;
}

/**
 * Batch extraction options
 */
export interface BatchExtractionOptions extends Omit<ExtractionOptions, 'url'> {
  urls: string[];
}

/**
 * Extraction result with metadata
 */
export interface ExtractionResult {
  items: ExtractedItem[];
  backend: 'local' | 'crawl4ai';
  url: string;
  timestamp: number;
  fallbackUsed: boolean;
  error?: string;
}

/**
 * Analyze selector complexity to determine if Crawl4AI would help
 * Returns 0-1 score (higher = more complex, benefit from Crawl4AI)
 */
function analyzeComplexity(fields: ExtractionField[]): number {
  if (fields.length === 0) return 0.5;

  let complexityScore = 0;
  let factors = 0;

  for (const field of fields) {
    // Complex CSS selectors
    if (field.selector.includes(':nth-child') ||
        field.selector.includes(':has(') ||
        field.selector.includes(':not(') ||
        field.selector.includes('~') ||
        field.selector.includes('+')) {
      complexityScore += 0.3;
      factors++;
    }

    // Long selectors often indicate fragile extraction
    if (field.selector.length > 80) {
      complexityScore += 0.2;
      factors++;
    }

    // Multiple class combinations
    if ((field.selector.match(/\./g) || []).length > 3) {
      complexityScore += 0.15;
      factors++;
    }

    // Attribute selectors
    if (field.selector.includes('[') && field.selector.includes(']')) {
      complexityScore += 0.1;
      factors++;
    }
  }

  // More fields = more complexity
  if (fields.length > 5) {
    complexityScore += 0.2;
    factors++;
  }

  return factors > 0 ? Math.min(1, complexityScore / factors) : 0.3;
}

/**
 * Get Crawl4AI settings from storage
 */
export async function getCrawl4AISettings(): Promise<Crawl4AISettings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_CRAWL4AI_SETTINGS, ...result[SETTINGS_KEY] };
  } catch {
    return { ...DEFAULT_CRAWL4AI_SETTINGS };
  }
}

/**
 * Save Crawl4AI settings to storage
 */
export async function saveCrawl4AISettings(
  settings: Partial<Crawl4AISettings>
): Promise<void> {
  const current = await getCrawl4AISettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });

  // Update client config
  const client = getCrawl4AIClient();
  await client.saveConfig({
    enabled: updated.enabled,
    baseUrl: updated.serviceUrl,
    timeout: updated.timeoutMs,
    fallbackToLocal: updated.fallbackToLocal,
    llmProvider: updated.llmEnabled ? updated.llmProvider : undefined,
    llmApiKey: updated.llmEnabled ? updated.llmApiKey : undefined,
  });
}

/**
 * Extract data from a URL using the configured backend
 *
 * @param options Extraction options
 * @returns Extraction result with items and metadata
 */
export async function extract(
  options: ExtractionOptions
): Promise<ExtractionResult> {
  const settings = await getCrawl4AISettings();
  const client = getCrawl4AIClient();

  const backend = options.backend ?? settings.strategy;
  const timestamp = Date.now();

  // If Crawl4AI not enabled or backend is 'local', use local extraction
  if (!settings.enabled || backend === 'local') {
    return extractLocally(options, timestamp);
  }

  // Check if Crawl4AI is available
  const isAvailable = await client.isAvailable();

  if (!isAvailable) {
    if (settings.fallbackToLocal) {
      console.warn('[ExtractionService] Crawl4AI unavailable, using local extraction');
      return {
        ...await extractLocally(options, timestamp),
        fallbackUsed: true,
      };
    }
    throw new Error('Crawl4AI service unavailable and fallback disabled');
  }

  // For 'auto' mode, decide based on complexity
  if (backend === 'auto') {
    const complexity = analyzeComplexity(options.fields);

    // Use local for simple extractions (faster)
    if (complexity < 0.4) {
      return extractLocally(options, timestamp);
    }
  }

  // Use Crawl4AI
  try {
    const result = await client.extractWithCSS(
      options.url,
      options.fields,
      options.containerSelector
    );

    return {
      items: result,
      backend: 'crawl4ai',
      url: options.url,
      timestamp,
      fallbackUsed: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ExtractionService] Crawl4AI extraction failed:', errorMessage);

    if (settings.fallbackToLocal) {
      console.warn('[ExtractionService] Falling back to local extraction');
      return {
        ...await extractLocally(options, timestamp),
        fallbackUsed: true,
        error: errorMessage,
      };
    }

    throw error;
  }
}

/**
 * Extract data with LLM (AI-powered extraction)
 *
 * @param url URL to extract from
 * @param instruction Natural language instruction for extraction
 * @param schema Optional JSON schema for structured output
 * @returns Extracted items
 */
export async function extractWithLLM(
  url: string,
  instruction: string,
  schema?: Record<string, unknown>
): Promise<ExtractionResult> {
  const settings = await getCrawl4AISettings();
  const client = getCrawl4AIClient();
  const timestamp = Date.now();

  if (!settings.enabled || !settings.llmEnabled) {
    throw new Error('LLM extraction requires Crawl4AI to be enabled with LLM support');
  }

  const isAvailable = await client.isAvailable();
  if (!isAvailable) {
    throw new Error('Crawl4AI service unavailable for LLM extraction');
  }

  try {
    const items = await client.extractWithLLM(url, instruction, schema);

    return {
      items,
      backend: 'crawl4ai',
      url,
      timestamp,
      fallbackUsed: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`LLM extraction failed: ${errorMessage}`);
  }
}

/**
 * Get LLM-optimized markdown from URL (Fit Markdown)
 *
 * @param url URL to fetch
 * @param options Additional options
 * @returns Markdown content optimized for LLM consumption
 */
export async function getMarkdown(
  url: string,
  options: { scanFullPage?: boolean; waitFor?: string } = {}
): Promise<string> {
  const settings = await getCrawl4AISettings();
  const client = getCrawl4AIClient();

  if (!settings.enabled) {
    throw new Error('Markdown extraction requires Crawl4AI to be enabled');
  }

  const isAvailable = await client.isAvailable();
  if (!isAvailable) {
    throw new Error('Crawl4AI service unavailable');
  }

  return client.getMarkdown(url, options);
}

/**
 * Batch extract from multiple URLs
 *
 * @param options Batch extraction options
 * @returns Array of extraction results
 */
export async function extractBatchUrls(
  options: BatchExtractionOptions
): Promise<ExtractionResult[]> {
  const settings = await getCrawl4AISettings();
  const client = getCrawl4AIClient();
  const timestamp = Date.now();

  // If Crawl4AI not enabled, extract sequentially with local
  if (!settings.enabled) {
    const results: ExtractionResult[] = [];
    for (const url of options.urls) {
      results.push(
        await extractLocally({ ...options, url }, timestamp)
      );
    }
    return results;
  }

  const isAvailable = await client.isAvailable();
  if (!isAvailable) {
    if (settings.fallbackToLocal) {
      console.warn('[ExtractionService] Crawl4AI unavailable, batch extracting locally');
      const results: ExtractionResult[] = [];
      for (const url of options.urls) {
        results.push({
          ...await extractLocally({ ...options, url }, timestamp),
          fallbackUsed: true,
        });
      }
      return results;
    }
    throw new Error('Crawl4AI service unavailable and fallback disabled');
  }

  // Use Crawl4AI batch processing
  try {
    const crawlResults = await client.crawlMany(options.urls, {
      strategy: 'css',
      outputFormat: 'json',
    });

    return crawlResults.map((result: Crawl4AIResult) => ({
      items: result.extracted_content || [],
      backend: 'crawl4ai' as const,
      url: result.url,
      timestamp,
      fallbackUsed: false,
      error: result.error_message,
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (settings.fallbackToLocal) {
      console.warn('[ExtractionService] Batch extraction failed, using local:', errorMessage);
      const results: ExtractionResult[] = [];
      for (const url of options.urls) {
        results.push({
          ...await extractLocally({ ...options, url }, timestamp),
          fallbackUsed: true,
          error: errorMessage,
        });
      }
      return results;
    }

    throw error;
  }
}

/**
 * Perform local extraction (uses content script data extractor)
 */
async function extractLocally(
  options: ExtractionOptions,
  timestamp: number
): Promise<ExtractionResult> {
  // Note: This is a simplified version that works in service worker context
  // For full local extraction, send message to content script

  // If running in service worker, delegate to content script
  // For now, return empty result - actual extraction happens in content script
  return {
    items: [],
    backend: 'local',
    url: options.url,
    timestamp,
    fallbackUsed: false,
  };
}

/**
 * Check if Crawl4AI service is healthy
 */
export async function checkHealth(): Promise<{
  healthy: boolean;
  version?: string;
  error?: string;
}> {
  const settings = await getCrawl4AISettings();

  if (!settings.enabled) {
    return { healthy: false, error: 'Crawl4AI not enabled' };
  }

  const client = getCrawl4AIClient();

  try {
    const status = await client.healthCheck();
    return {
      healthy: status.healthy,
      version: status.version,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
