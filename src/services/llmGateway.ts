/**
 * LLM Gateway - Multi-provider LLM integration with fallback
 * DIF-2: Supports Anthropic, OpenAI, Groq, and Ollama (local)
 */

import { RateLimiter, DEFAULT_RATE_LIMIT_CONFIG } from '../utils/rateLimiter';
import { withRetry, DEFAULT_RETRY_CONFIG, APIError } from '../utils/retry';
import { redact, restore } from '../utils/redaction';
import { getKeyVault } from '../utils/encryption';
import type { RetryConfig } from '../types/ai';

/**
 * Supported LLM providers
 */
export type LLMProvider = 'anthropic' | 'openai' | 'groq' | 'ollama' | 'gemini' | 'deepseek';

/**
 * LLM request options
 */
export interface LLMRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stream?: boolean;
}

/**
 * LLM response
 */
export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

/**
 * Provider configuration
 */
interface ProviderConfig {
  baseUrl: string;
  defaultModel: string;
  authHeader: string;
  formatRequest: (
    prompt: string,
    options: LLMRequestOptions
  ) => Record<string, unknown>;
  parseResponse: (data: unknown) => Partial<LLMResponse>;
}

/**
 * Provider configurations
 */
const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-20250514',
    authHeader: 'x-api-key',
    formatRequest: (prompt, options) => ({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }],
      ...(options.systemPrompt && { system: options.systemPrompt }),
    }),
    parseResponse: (data: unknown) => {
      const d = data as {
        content?: Array<{ text?: string }>;
        model?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
        stop_reason?: string;
      };
      return {
        content: d.content?.[0]?.text || '',
        model: d.model || '',
        usage: d.usage
          ? {
              promptTokens: d.usage.input_tokens || 0,
              completionTokens: d.usage.output_tokens || 0,
              totalTokens: (d.usage.input_tokens || 0) + (d.usage.output_tokens || 0),
            }
          : undefined,
        finishReason: d.stop_reason,
      };
    },
  },

  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    authHeader: 'Authorization',
    formatRequest: (prompt, options) => ({
      model: options.model || 'gpt-4o-mini',
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
      messages: [
        ...(options.systemPrompt
          ? [{ role: 'system', content: options.systemPrompt }]
          : []),
        { role: 'user', content: prompt },
      ],
    }),
    parseResponse: (data: unknown) => {
      const d = data as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        model?: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      return {
        content: d.choices?.[0]?.message?.content || '',
        model: d.model || '',
        usage: d.usage
          ? {
              promptTokens: d.usage.prompt_tokens || 0,
              completionTokens: d.usage.completion_tokens || 0,
              totalTokens: d.usage.total_tokens || 0,
            }
          : undefined,
        finishReason: d.choices?.[0]?.finish_reason,
      };
    },
  },

  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.1-8b-instant',
    authHeader: 'Authorization',
    formatRequest: (prompt, options) => ({
      model: options.model || 'llama-3.1-8b-instant',
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
      messages: [
        ...(options.systemPrompt
          ? [{ role: 'system', content: options.systemPrompt }]
          : []),
        { role: 'user', content: prompt },
      ],
    }),
    parseResponse: (data: unknown) => {
      // Same format as OpenAI
      const d = data as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        model?: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      return {
        content: d.choices?.[0]?.message?.content || '',
        model: d.model || '',
        usage: d.usage
          ? {
              promptTokens: d.usage.prompt_tokens || 0,
              completionTokens: d.usage.completion_tokens || 0,
              totalTokens: d.usage.total_tokens || 0,
            }
          : undefined,
        finishReason: d.choices?.[0]?.finish_reason,
      };
    },
  },

  ollama: {
    baseUrl: 'http://localhost:11434/api/generate',
    defaultModel: 'llama3.2',
    authHeader: '', // No auth for local
    formatRequest: (prompt, options) => ({
      model: options.model || 'llama3.2',
      prompt: options.systemPrompt
        ? `${options.systemPrompt}\n\n${prompt}`
        : prompt,
      stream: false,
      options: {
        num_predict: options.maxTokens || 1024,
        temperature: options.temperature ?? 0.7,
      },
    }),
    parseResponse: (data: unknown) => {
      const d = data as {
        response?: string;
        model?: string;
        done_reason?: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };
      return {
        content: d.response || '',
        model: d.model || '',
        usage: {
          promptTokens: d.prompt_eval_count || 0,
          completionTokens: d.eval_count || 0,
          totalTokens: (d.prompt_eval_count || 0) + (d.eval_count || 0),
        },
        finishReason: d.done_reason,
      };
    },
  },

  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-2.0-flash',
    authHeader: '', // Uses query param instead
    formatRequest: (prompt, options) => ({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      ...(options.systemPrompt && {
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
      }),
      generationConfig: {
        maxOutputTokens: options.maxTokens || 1024,
        temperature: options.temperature ?? 0.7,
      },
    }),
    parseResponse: (data: unknown) => {
      const d = data as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        modelVersion?: string;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };
      return {
        content: d.candidates?.[0]?.content?.parts?.[0]?.text || '',
        model: d.modelVersion || '',
        usage: d.usageMetadata
          ? {
              promptTokens: d.usageMetadata.promptTokenCount || 0,
              completionTokens: d.usageMetadata.candidatesTokenCount || 0,
              totalTokens: d.usageMetadata.totalTokenCount || 0,
            }
          : undefined,
        finishReason: d.candidates?.[0]?.finishReason,
      };
    },
  },

  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    authHeader: 'Authorization',
    formatRequest: (prompt, options) => ({
      model: options.model || 'deepseek-chat',
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
      messages: [
        ...(options.systemPrompt
          ? [{ role: 'system', content: options.systemPrompt }]
          : []),
        { role: 'user', content: prompt },
      ],
    }),
    parseResponse: (data: unknown) => {
      // Same format as OpenAI
      const d = data as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        model?: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      return {
        content: d.choices?.[0]?.message?.content || '',
        model: d.model || '',
        usage: d.usage
          ? {
              promptTokens: d.usage.prompt_tokens || 0,
              completionTokens: d.usage.completion_tokens || 0,
              totalTokens: d.usage.total_tokens || 0,
            }
          : undefined,
        finishReason: d.choices?.[0]?.finish_reason,
      };
    },
  },
};

/**
 * LLM Gateway configuration
 */
export interface LLMGatewayConfig {
  providers: LLMProvider[];
  defaultProvider: LLMProvider;
  password?: string; // For decrypting stored API keys
  rateLimitConfig?: typeof DEFAULT_RATE_LIMIT_CONFIG;
  retryConfig?: RetryConfig;
  redactSensitiveData?: boolean;
}

const DEFAULT_GATEWAY_CONFIG: LLMGatewayConfig = {
  providers: ['anthropic', 'openai', 'gemini', 'deepseek', 'groq', 'ollama'],
  defaultProvider: 'gemini',
  redactSensitiveData: true,
};

/**
 * LLM Gateway with multi-provider support and fallback
 */
export class LLMGateway {
  private rateLimiter: RateLimiter;
  private config: LLMGatewayConfig;
  private apiKeys: Map<LLMProvider, string> = new Map();
  private ollamaUrl: string = 'http://localhost:11434';

  constructor(config: Partial<LLMGatewayConfig> = {}) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.rateLimiter = new RateLimiter(
      config.rateLimitConfig || DEFAULT_RATE_LIMIT_CONFIG
    );
  }

  /**
   * Set API key for a provider
   */
  setApiKey(provider: LLMProvider, key: string): void {
    this.apiKeys.set(provider, key);
  }

  /**
   * Set Ollama URL for local LLM
   */
  setOllamaUrl(url: string): void {
    this.ollamaUrl = url;
  }

  /**
   * Load API keys from encrypted storage
   */
  async loadKeysFromStorage(password: string): Promise<void> {
    const vault = getKeyVault();

    for (const provider of this.config.providers) {
      if (provider === 'ollama') continue; // No key needed

      try {
        const key = await vault.retrieve(provider, password);
        this.apiKeys.set(provider, key);
      } catch {
        // Key not found, skip
      }
    }
  }

  /**
   * Complete a prompt with automatic fallback
   */
  async complete(
    prompt: string,
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    // Rate limit
    return this.rateLimiter.throttle(async () => {
      // Redact sensitive data if enabled
      let processedPrompt = prompt;
      let redactionResult: ReturnType<typeof redact> | null = null;

      if (this.config.redactSensitiveData) {
        redactionResult = redact(prompt);
        processedPrompt = redactionResult.redacted;
      }

      // Try providers in order with fallback
      const providersToTry = options.model
        ? [this.config.defaultProvider]
        : this.config.providers;

      let lastError: Error | null = null;

      for (const provider of providersToTry) {
        try {
          const response = await this.callProvider(
            provider,
            processedPrompt,
            options
          );

          // Restore redacted content in response if needed
          if (redactionResult && redactionResult.placeholders.size > 0) {
            response.content = restore(
              response.content,
              redactionResult.placeholders
            );
          }

          return response;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`[LLMGateway] ${provider} failed:`, lastError.message);

          // Don't try other providers for certain errors
          if (error instanceof APIError && error.statusCode === 401) {
            // Auth error - don't fallback, the key is wrong
            break;
          }
        }
      }

      throw lastError || new Error('All providers failed');
    });
  }

  /**
   * Complete with specific provider (no fallback)
   */
  async completeWith(
    provider: LLMProvider,
    prompt: string,
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    return this.rateLimiter.throttle(() =>
      this.callProvider(provider, prompt, options)
    );
  }

  /**
   * Check if a provider is available
   */
  async isProviderAvailable(provider: LLMProvider): Promise<boolean> {
    if (provider === 'ollama') {
      try {
        const response = await fetch(`${this.ollamaUrl}/api/tags`);
        return response.ok;
      } catch {
        return false;
      }
    }

    return this.apiKeys.has(provider);
  }

  /**
   * Get available providers
   */
  async getAvailableProviders(): Promise<LLMProvider[]> {
    const available: LLMProvider[] = [];

    for (const provider of this.config.providers) {
      if (await this.isProviderAvailable(provider)) {
        available.push(provider);
      }
    }

    return available;
  }

  private async callProvider(
    provider: LLMProvider,
    prompt: string,
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    const config = PROVIDER_CONFIGS[provider];
    const retryConfig = this.config.retryConfig || DEFAULT_RETRY_CONFIG;

    return withRetry(async () => {
      const apiKey = this.apiKeys.get(provider);

      // Check auth for non-Ollama providers
      if (provider !== 'ollama' && !apiKey) {
        throw new Error(`No API key configured for ${provider}`);
      }

      // Build URL based on provider
      let url: string;
      if (provider === 'ollama') {
        url = `${this.ollamaUrl}/api/generate`;
      } else if (provider === 'gemini') {
        // Gemini uses model in URL path and API key as query param
        const model = options.model || config.defaultModel;
        url = `${config.baseUrl}/${model}:generateContent?key=${apiKey}`;
      } else {
        url = config.baseUrl;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add auth headers (skip for Ollama and Gemini)
      if (apiKey && config.authHeader && provider !== 'gemini') {
        if (config.authHeader === 'Authorization') {
          headers[config.authHeader] = `Bearer ${apiKey}`;
        } else {
          headers[config.authHeader] = apiKey;
        }
      }

      // Add Anthropic-specific headers
      if (provider === 'anthropic') {
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }

      const body = config.formatRequest(prompt, {
        ...options,
        model: options.model || config.defaultModel,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw await APIError.fromResponse(response);
      }

      const data = await response.json();
      const parsed = config.parseResponse(data);

      return {
        content: parsed.content || '',
        provider,
        model: parsed.model || options.model || config.defaultModel,
        usage: parsed.usage,
        finishReason: parsed.finishReason,
      };
    }, retryConfig);
  }
}

// Singleton instance
let gatewayInstance: LLMGateway | null = null;

/**
 * Get the global LLM gateway instance
 */
export function getLLMGateway(): LLMGateway {
  if (!gatewayInstance) {
    gatewayInstance = new LLMGateway();
  }
  return gatewayInstance;
}
