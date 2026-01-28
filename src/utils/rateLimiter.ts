/**
 * Rate limiter for API calls
 * AI-1: Implements minimum interval enforcement between LLM API calls
 */

import type { RateLimiterConfig } from '../types/ai';

interface QueuedCall<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Rate limiter that enforces minimum intervals between async function calls.
 * Uses a queue to handle bursts of requests.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({ minIntervalMs: 500 });
 *
 * // These calls will be spaced at least 500ms apart
 * const results = await Promise.all([
 *   limiter.throttle(() => fetchFromAPI('query1')),
 *   limiter.throttle(() => fetchFromAPI('query2')),
 *   limiter.throttle(() => fetchFromAPI('query3')),
 * ]);
 * ```
 */
export class RateLimiter {
  private lastCallTime = 0;
  private queue: QueuedCall<unknown>[] = [];
  private processing = false;
  private readonly config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig) {
    this.config = {
      minIntervalMs: config.minIntervalMs,
      maxConcurrent: config.maxConcurrent ?? 1,
    };

    if (this.config.minIntervalMs < 0) {
      throw new Error('minIntervalMs must be non-negative');
    }
  }

  /**
   * Throttle an async function call, ensuring minimum interval between calls.
   * If called while another call is in progress, queues the call for later.
   */
  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  /**
   * Returns the current queue length (calls waiting to be executed)
   */
  get queueLength(): number {
    return this.queue.length;
  }

  /**
   * Clears the queue, rejecting all pending calls
   */
  clear(): void {
    const error = new Error('Rate limiter queue cleared');
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      item?.reject(error);
    }
  }

  /**
   * Returns the time until the next call can be made (in ms)
   */
  get timeUntilNext(): number {
    const elapsed = Date.now() - this.lastCallTime;
    return Math.max(0, this.config.minIntervalMs - elapsed);
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      // Wait for minimum interval
      const elapsed = Date.now() - this.lastCallTime;
      const waitTime = Math.max(0, this.config.minIntervalMs - elapsed);

      if (waitTime > 0) {
        await this.delay(waitTime);
      }

      // Execute the call
      this.lastCallTime = Date.now();

      try {
        const result = await item.fn();
        item.resolve(result);
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Creates a rate-limited version of an async function
 *
 * @example
 * ```typescript
 * const rateLimitedFetch = createRateLimitedFn(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { minIntervalMs: 500 }
 * );
 *
 * // Calls are automatically rate-limited
 * await rateLimitedFetch('/api/data1');
 * await rateLimitedFetch('/api/data2');
 * ```
 */
export function createRateLimitedFn<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: RateLimiterConfig
): (...args: TArgs) => Promise<TResult> {
  const limiter = new RateLimiter(config);
  return (...args: TArgs) => limiter.throttle(() => fn(...args));
}

/** Default configuration for LLM API rate limiting */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimiterConfig = {
  minIntervalMs: 500,
  maxConcurrent: 1,
};
