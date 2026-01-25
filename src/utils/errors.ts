/**
 * Error handling utilities for the web scraper extension
 */

/**
 * Custom error class for scraper-specific errors
 */
export class ScraperError extends Error {
  public readonly code: string;
  public readonly recoverable: boolean;

  constructor(message: string, code: string, recoverable = true) {
    super(message);
    this.name = 'ScraperError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

/**
 * Error codes for categorizing scraper errors
 */
export const ErrorCodes = {
  SCROLL_FAILED: 'SCROLL_FAILED',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  MUTATION_TIMEOUT: 'MUTATION_TIMEOUT',
  LOAD_MORE_FAILED: 'LOAD_MORE_FAILED',
  INVALID_CONFIG: 'INVALID_CONFIG',
  ALREADY_RUNNING: 'ALREADY_RUNNING',
  NOT_RUNNING: 'NOT_RUNNING',
  DOM_ERROR: 'DOM_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Creates a formatted error message with timestamp
 */
export function formatError(error: unknown): string {
  const timestamp = new Date().toISOString();

  if (error instanceof ScraperError) {
    return `[${timestamp}] ${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return `[${timestamp}] ERROR: ${error.message}`;
  }

  return `[${timestamp}] ERROR: ${String(error)}`;
}

/**
 * Safely extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Checks if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof ScraperError) {
    return error.recoverable;
  }
  // Default to recoverable for unknown errors
  return true;
}

/**
 * Creates a ScraperError from an unknown error
 */
export function wrapError(
  error: unknown,
  code: ErrorCode = ErrorCodes.DOM_ERROR,
  recoverable = true
): ScraperError {
  const message = getErrorMessage(error);
  return new ScraperError(message, code, recoverable);
}

/**
 * Calculates exponential backoff delay
 * @param attempt - The current attempt number (0-indexed)
 * @param baseDelayMs - The base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap (default: 30 seconds)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs = 30000
): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}
