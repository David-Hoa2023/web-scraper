/**
 * AI-related type definitions for the web scraper extension
 * Part of Phase 1: Critical Gaps implementation
 */

/**
 * Configuration for rate limiting API calls
 */
export interface RateLimiterConfig {
  /** Minimum milliseconds between calls (default: 500) */
  minIntervalMs: number;
  /** Maximum concurrent calls (default: 1) */
  maxConcurrent?: number;
}

/**
 * Configuration for retry with exponential backoff
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;
  /** Custom predicate to determine if error should trigger retry */
  retryOn?: (error: Error) => boolean;
}

/**
 * Result of a redaction operation
 */
export interface RedactionResult {
  /** Text with sensitive data replaced by placeholders */
  redacted: string;
  /** Map of placeholder -> original value for restoration */
  placeholders: Map<string, string>;
  /** Count of redactions by type */
  counts: Record<string, number>;
}

/**
 * Types of sensitive data that can be redacted
 */
export type RedactionType =
  | 'CREDIT_CARD'
  | 'SSN'
  | 'EMAIL'
  | 'API_KEY'
  | 'AWS_KEY'
  | 'JWT'
  | 'PHONE'
  | 'IP_ADDRESS';

/**
 * Configuration for encryption operations
 */
export interface EncryptionConfig {
  /** Encryption algorithm (only AES-GCM supported) */
  algorithm: 'AES-GCM';
  /** Key derivation function (only PBKDF2 supported) */
  keyDerivation: 'PBKDF2';
  /** Number of PBKDF2 iterations (default: 100000) */
  iterations: number;
  /** Salt length in bytes (default: 16) */
  saltLength: number;
}

/**
 * Encrypted data structure for storage
 */
export interface EncryptedData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector */
  iv: string;
  /** Base64-encoded salt used for key derivation */
  salt: string;
  /** Schema version for future migrations */
  version: number;
}

/**
 * Error codes specific to AI operations
 */
export const AIErrorCodes = {
  RATE_LIMITED: 'RATE_LIMITED',
  API_ERROR: 'API_ERROR',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
} as const;

export type AIErrorCode = (typeof AIErrorCodes)[keyof typeof AIErrorCodes];

/**
 * Stored API key entry
 */
export interface StoredKeyEntry {
  /** Name/identifier for the key */
  name: string;
  /** Encrypted data */
  data: EncryptedData;
  /** When the key was stored */
  createdAt: number;
  /** When the key was last accessed */
  lastAccessedAt?: number;
}
