/**
 * Retry utilities with exponential backoff
 * AI-2: Implements resilient API communication with automatic retries
 */

import type { RetryConfig, AIErrorCode } from '../types/ai';
import { AIErrorCodes } from '../types/ai';
import { ScraperError, calculateBackoff } from './errors';

/**
 * Extended error class for API-specific errors
 */
export class APIError extends ScraperError {
  public readonly statusCode?: number;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    code: AIErrorCode,
    options?: {
      statusCode?: number;
      retryAfter?: number;
      recoverable?: boolean;
    }
  ) {
    super(message, code, options?.recoverable ?? true);
    this.name = 'APIError';
    this.statusCode = options?.statusCode;
    this.retryAfter = options?.retryAfter;
  }

  /**
   * Creates an APIError from a fetch Response
   */
  static async fromResponse(response: Response): Promise<APIError> {
    let message = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const body = await response.text();
      if (body) {
        const json = JSON.parse(body);
        message = json.error?.message || json.message || message;
      }
    } catch {
      // Ignore parse errors
    }

    const retryAfter = response.headers.get('Retry-After');
    const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;

    const code = response.status === 429 ? AIErrorCodes.RATE_LIMITED : AIErrorCodes.API_ERROR;
    const recoverable = response.status >= 500 || response.status === 429;

    return new APIError(message, code, {
      statusCode: response.status,
      retryAfter: retryAfterMs,
      recoverable,
    });
  }
}

/**
 * Default predicate for determining if an error should trigger a retry
 */
function defaultRetryPredicate(error: Error): boolean {
  if (error instanceof APIError) {
    // Retry on rate limits and server errors
    if (error.code === AIErrorCodes.RATE_LIMITED) return true;
    if (error.statusCode && error.statusCode >= 500) return true;
    return error.recoverable;
  }

  if (error instanceof ScraperError) {
    return error.recoverable;
  }

  // Retry on network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Adds jitter to a delay to prevent thundering herd
 * @param delay Base delay in milliseconds
 * @param jitterFactor Factor of jitter (0-1, default 0.1 = 10%)
 */
function addJitter(delay: number, jitterFactor = 0.1): number {
  const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, delay + jitter);
}

/**
 * Executes an async function with retry and exponential backoff
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   {
 *     maxRetries: 3,
 *     baseDelayMs: 1000,
 *     maxDelayMs: 30000,
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryOn } = config;
  const shouldRetry = retryOn ?? defaultRetryPredicate;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt >= maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      // Calculate delay with backoff
      let delay: number;

      // Respect Retry-After header if present
      if (lastError instanceof APIError && lastError.retryAfter) {
        delay = lastError.retryAfter;
      } else {
        delay = calculateBackoff(attempt, baseDelayMs, maxDelayMs);
      }

      // Add jitter to prevent thundering herd
      delay = addJitter(delay);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? new Error('Retry failed');
}

/**
 * Creates a retrying version of an async function
 *
 * @example
 * ```typescript
 * const fetchWithRetry = createRetryingFn(
 *   async (url: string) => {
 *     const response = await fetch(url);
 *     if (!response.ok) throw await APIError.fromResponse(response);
 *     return response.json();
 *   },
 *   { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 }
 * );
 *
 * const data = await fetchWithRetry('/api/data');
 * ```
 */
export function createRetryingFn<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: RetryConfig
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), config);
}

/** Default configuration for API retries */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Checks if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is APIError {
  return error instanceof APIError && error.code === AIErrorCodes.RATE_LIMITED;
}

/**
 * Checks if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === 'TypeError' ||
      error.message.includes('network') ||
      error.message.includes('fetch')
    );
  }
  return false;
}
