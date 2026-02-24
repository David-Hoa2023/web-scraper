/**
 * Crawl4AI Client - HTTP client for Crawl4AI backend service
 *
 * Provides integration with Crawl4AI Docker service for:
 * - LLM-powered extraction
 * - Batch URL processing
 * - Advanced content normalization (Fit Markdown)
 *
 * @see https://github.com/unclecode/crawl4ai
 */

import type { ExtractionField, ExtractedItem } from '../types';

/**
 * Crawl4AI extraction strategies
 */
export type Crawl4AIStrategy = 'css' | 'xpath' | 'llm' | 'regex';

/**
 * Crawl4AI configuration
 */
export interface Crawl4AIConfig {
  enabled: boolean;
  baseUrl: string;
  timeout: number;
  retries: number;
  fallbackToLocal: boolean;
  llmProvider?: string;
  llmApiKey?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_CRAWL4AI_CONFIG: Crawl4AIConfig = {
  enabled: false,
  baseUrl: 'http://localhost:11235',
  timeout: 30000,
  retries: 2,
  fallbackToLocal: true,
};

/**
 * Crawl4AI schema field for CSS/XPath extraction
 */
interface Crawl4AISchemaField {
  name: string;
  selector: string;
  type: 'text' | 'attribute' | 'html' | 'nested' | 'list';
  attribute?: string;
}

/**
 * Crawl4AI extraction schema
 */
interface Crawl4AISchema {
  name: string;
  baseSelector: string;
  fields: Crawl4AISchemaField[];
}

/**
 * Crawl4AI crawl request
 */
interface CrawlRequest {
  urls: string[];
  extraction_strategy?: Crawl4AIStrategy;
  schema?: Crawl4AISchema;
  output_format?: 'markdown' | 'html' | 'json';
  cache_mode?: 'enabled' | 'bypass' | 'disabled';
  wait_for?: string;
  scan_full_page?: boolean;
  screenshot?: boolean;
  llm_config?: {
    provider: string;
    api_token: string;
    instruction?: string;
  };
}

/**
 * Crawl4AI crawl result
 */
export interface Crawl4AIResult {
  url: string;
  success: boolean;
  markdown?: string;
  html?: string;
  extracted_content?: ExtractedItem[];
  links?: {
    internal: Array<{ href: string; text: string }>;
    external: Array<{ href: string; text: string }>;
  };
  media?: {
    images: Array<{ src: string; alt?: string }>;
  };
  screenshot?: string;
  error_message?: string;
}

/**
 * Crawl4AI health status
 */
interface HealthStatus {
  healthy: boolean;
  version?: string;
  browser_pool?: {
    active: number;
    available: number;
  };
}

/**
 * Storage key for Crawl4AI config
 */
const STORAGE_KEY = 'crawl4ai-config';

/**
 * Crawl4AI Client
 *
 * HTTP client for communicating with Crawl4AI Docker service
 */
export class Crawl4AIClient {
  private config: Crawl4AIConfig;
  private healthCache: { status: HealthStatus | null; timestamp: number } = {
    status: null,
    timestamp: 0,
  };
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds

  constructor(config: Partial<Crawl4AIConfig> = {}) {
    this.config = { ...DEFAULT_CRAWL4AI_CONFIG, ...config };
  }

  /**
   * Load configuration from Chrome storage
   */
  async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        this.config = { ...this.config, ...result[STORAGE_KEY] };
      }
    } catch (error) {
      console.warn('[Crawl4AI] Failed to load config:', error);
    }
  }

  /**
   * Save configuration to Chrome storage
   */
  async saveConfig(config: Partial<Crawl4AIConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: this.config });
    } catch (error) {
      console.warn('[Crawl4AI] Failed to save config:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Crawl4AIConfig {
    return { ...this.config };
  }

  /**
   * Check if Crawl4AI is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if Crawl4AI service is healthy
   */
  async healthCheck(): Promise<HealthStatus> {
    // Return cached status if fresh
    const now = Date.now();
    if (
      this.healthCache.status &&
      now - this.healthCache.timestamp < this.HEALTH_CACHE_TTL
    ) {
      return this.healthCache.status;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status: HealthStatus = { healthy: false };
        this.healthCache = { status, timestamp: now };
        return status;
      }

      const data = await response.json();
      const status: HealthStatus = {
        healthy: true,
        version: data.version,
        browser_pool: data.browser_pool,
      };

      this.healthCache = { status, timestamp: now };
      return status;
    } catch (error) {
      const status: HealthStatus = { healthy: false };
      this.healthCache = { status, timestamp: now };
      return status;
    }
  }

  /**
   * Check if service is available (quick check)
   */
  async isAvailable(): Promise<boolean> {
    const status = await this.healthCheck();
    return status.healthy;
  }

  /**
   * Crawl a single URL
   */
  async crawl(
    url: string,
    options: {
      strategy?: Crawl4AIStrategy;
      schema?: Crawl4AISchema;
      outputFormat?: 'markdown' | 'html' | 'json';
      cacheMode?: 'enabled' | 'bypass' | 'disabled';
      waitFor?: string;
      scanFullPage?: boolean;
      screenshot?: boolean;
      llmInstruction?: string;
    } = {}
  ): Promise<Crawl4AIResult> {
    const results = await this.crawlMany([url], options);
    return results[0];
  }

  /**
   * Crawl multiple URLs (batch)
   */
  async crawlMany(
    urls: string[],
    options: {
      strategy?: Crawl4AIStrategy;
      schema?: Crawl4AISchema;
      outputFormat?: 'markdown' | 'html' | 'json';
      cacheMode?: 'enabled' | 'bypass' | 'disabled';
      waitFor?: string;
      scanFullPage?: boolean;
      screenshot?: boolean;
      llmInstruction?: string;
    } = {}
  ): Promise<Crawl4AIResult[]> {
    const request: CrawlRequest = {
      urls,
      extraction_strategy: options.strategy ?? 'css',
      output_format: options.outputFormat ?? 'markdown',
      cache_mode: options.cacheMode ?? 'enabled',
      scan_full_page: options.scanFullPage ?? false,
      screenshot: options.screenshot ?? false,
    };

    if (options.schema) {
      request.schema = options.schema;
    }

    if (options.waitFor) {
      request.wait_for = options.waitFor;
    }

    // Add LLM config if using LLM strategy
    if (options.strategy === 'llm' && this.config.llmProvider) {
      request.llm_config = {
        provider: this.config.llmProvider,
        api_token: this.config.llmApiKey || '',
        instruction: options.llmInstruction,
      };
    }

    return this.makeRequest<Crawl4AIResult[]>(
      urls.length === 1 ? '/crawl' : '/crawl-many',
      request
    );
  }

  /**
   * Extract data using CSS selectors
   */
  async extractWithCSS(
    url: string,
    fields: ExtractionField[],
    containerSelector?: string
  ): Promise<ExtractedItem[]> {
    const schema: Crawl4AISchema = {
      name: 'Extraction',
      baseSelector: containerSelector || 'body',
      fields: fields.map((f) => ({
        name: f.name,
        selector: f.selector,
        type: f.type === 'href' || f.type === 'src' ? 'attribute' : 'text',
        attribute: f.type === 'href' ? 'href' : f.type === 'src' ? 'src' : f.attrName,
      })),
    };

    const result = await this.crawl(url, {
      strategy: 'css',
      schema,
      outputFormat: 'json',
    });

    return result.extracted_content || [];
  }

  /**
   * Extract data using LLM (AI-powered)
   */
  async extractWithLLM(
    url: string,
    instruction: string,
    schema?: Record<string, unknown>
  ): Promise<ExtractedItem[]> {
    if (!this.config.llmProvider || !this.config.llmApiKey) {
      throw new Error('LLM provider not configured. Set llmProvider and llmApiKey in config.');
    }

    const request: CrawlRequest = {
      urls: [url],
      extraction_strategy: 'llm',
      output_format: 'json',
      llm_config: {
        provider: this.config.llmProvider,
        api_token: this.config.llmApiKey,
        instruction,
      },
    };

    if (schema) {
      (request as Record<string, unknown>).schema = schema;
    }

    const results = await this.makeRequest<Crawl4AIResult[]>('/crawl', request);
    return results[0]?.extracted_content || [];
  }

  /**
   * Get markdown content from URL (Fit Markdown - LLM optimized)
   */
  async getMarkdown(
    url: string,
    options: {
      scanFullPage?: boolean;
      waitFor?: string;
    } = {}
  ): Promise<string> {
    const result = await this.crawl(url, {
      outputFormat: 'markdown',
      scanFullPage: options.scanFullPage,
      waitFor: options.waitFor,
    });

    return result.markdown || '';
  }

  /**
   * Make HTTP request to Crawl4AI service
   */
  private async makeRequest<T>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout
        );

        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Crawl4AI error (${response.status}): ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort (timeout)
        if (lastError.name === 'AbortError') {
          throw new Error(`Crawl4AI request timed out after ${this.config.timeout}ms`);
        }

        // Exponential backoff
        if (attempt < this.config.retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError || new Error('Crawl4AI request failed');
  }
}

// Singleton instance
let clientInstance: Crawl4AIClient | null = null;

/**
 * Get the global Crawl4AI client instance
 */
export function getCrawl4AIClient(): Crawl4AIClient {
  if (!clientInstance) {
    clientInstance = new Crawl4AIClient();
  }
  return clientInstance;
}

/**
 * Initialize Crawl4AI client with config from storage
 */
export async function initCrawl4AIClient(): Promise<Crawl4AIClient> {
  const client = getCrawl4AIClient();
  await client.loadConfig();
  return client;
}
