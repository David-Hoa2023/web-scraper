/**
 * API key encryption utilities using Web Crypto API
 * AI-4: Implements secure encryption for API keys at rest
 */

import type { EncryptedData, EncryptionConfig, StoredKeyEntry, AIErrorCode } from '../types/ai';
import { AIErrorCodes } from '../types/ai';
import { ScraperError } from './errors';

/**
 * Error class for encryption-related errors
 */
export class EncryptionError extends ScraperError {
  constructor(message: string, code: AIErrorCode) {
    super(message, code, false);
    this.name = 'EncryptionError';
  }
}

/**
 * Default encryption configuration
 * Uses industry-standard secure defaults
 */
const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keyDerivation: 'PBKDF2',
  iterations: 100000,
  saltLength: 16,
};

/**
 * IV length for AES-GCM (12 bytes recommended by NIST)
 */
const IV_LENGTH = 12;

/**
 * Current encryption schema version
 */
const SCHEMA_VERSION = 1;

/**
 * Storage key prefix for encrypted API keys
 */
const STORAGE_PREFIX = 'encrypted_key_';

/**
 * Converts a Uint8Array to a Base64 string
 */
function arrayToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

/**
 * Converts a Base64 string to a Uint8Array
 */
function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * Secure key vault for storing and retrieving encrypted API keys
 *
 * @example
 * ```typescript
 * const vault = new KeyVault();
 *
 * // Store an API key
 * await vault.store('openai', 'sk-xxx...', 'user-password');
 *
 * // Retrieve it later
 * const apiKey = await vault.retrieve('openai', 'user-password');
 * ```
 */
export class KeyVault {
  private readonly config: EncryptionConfig;

  constructor(config?: Partial<EncryptionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Derives an encryption key from a password using PBKDF2
   */
  private async deriveKey(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    // Import password as raw key material
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES-GCM key using PBKDF2
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: this.config.iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts an API key with a user-provided password
   *
   * @param apiKey - The API key to encrypt
   * @param password - User password for encryption
   * @returns Encrypted data structure
   */
  async encrypt(apiKey: string, password: string): Promise<EncryptedData> {
    if (!password || password.length < 8) {
      throw new EncryptionError(
        'Password must be at least 8 characters',
        AIErrorCodes.ENCRYPTION_FAILED
      );
    }

    try {
      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.config.saltLength));
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Encrypt the API key
      const encoded = new TextEncoder().encode(apiKey);
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        encoded.buffer as ArrayBuffer
      );

      return {
        ciphertext: arrayToBase64(new Uint8Array(ciphertext)),
        iv: arrayToBase64(iv),
        salt: arrayToBase64(salt),
        version: SCHEMA_VERSION,
      };
    } catch (error) {
      throw new EncryptionError(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
        AIErrorCodes.ENCRYPTION_FAILED
      );
    }
  }

  /**
   * Decrypts an API key with a user-provided password
   *
   * @param data - Encrypted data structure
   * @param password - User password for decryption
   * @returns Decrypted API key
   */
  async decrypt(data: EncryptedData, password: string): Promise<string> {
    try {
      const ciphertext = base64ToArray(data.ciphertext);
      const iv = base64ToArray(data.iv);
      const salt = base64ToArray(data.salt);

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Decrypt the API key
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        ciphertext.buffer as ArrayBuffer
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      // AES-GCM will fail authentication if password is wrong
      if (
        error instanceof Error &&
        error.message.includes('operation failed')
      ) {
        throw new EncryptionError(
          'Invalid password or corrupted data',
          AIErrorCodes.INVALID_PASSWORD
        );
      }
      throw new EncryptionError(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
        AIErrorCodes.DECRYPTION_FAILED
      );
    }
  }

  /**
   * Stores an encrypted API key in chrome.storage.local
   *
   * @param name - Identifier for the key (e.g., 'openai', 'anthropic')
   * @param apiKey - The API key to store
   * @param password - User password for encryption
   */
  async store(name: string, apiKey: string, password: string): Promise<void> {
    const encrypted = await this.encrypt(apiKey, password);

    const entry: StoredKeyEntry = {
      name,
      data: encrypted,
      createdAt: Date.now(),
    };

    const storageKey = STORAGE_PREFIX + name;

    // Use chrome.storage.local (not sync for security)
    await chrome.storage.local.set({ [storageKey]: entry });
  }

  /**
   * Retrieves and decrypts an API key from chrome.storage.local
   *
   * @param name - Identifier for the key
   * @param password - User password for decryption
   * @returns Decrypted API key
   */
  async retrieve(name: string, password: string): Promise<string> {
    const storageKey = STORAGE_PREFIX + name;

    const result = await chrome.storage.local.get(storageKey);
    const entry = result[storageKey] as StoredKeyEntry | undefined;

    if (!entry) {
      throw new EncryptionError(
        `Key not found: ${name}`,
        AIErrorCodes.KEY_NOT_FOUND
      );
    }

    // Update last accessed time
    entry.lastAccessedAt = Date.now();
    await chrome.storage.local.set({ [storageKey]: entry });

    return this.decrypt(entry.data, password);
  }

  /**
   * Lists all stored key names (without decrypting)
   */
  async listKeys(): Promise<string[]> {
    const all = await chrome.storage.local.get(null);
    const keys: string[] = [];

    for (const key of Object.keys(all)) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const entry = all[key] as StoredKeyEntry;
        keys.push(entry.name);
      }
    }

    return keys;
  }

  /**
   * Deletes a stored key
   *
   * @param name - Identifier for the key to delete
   */
  async delete(name: string): Promise<void> {
    const storageKey = STORAGE_PREFIX + name;
    await chrome.storage.local.remove(storageKey);
  }

  /**
   * Checks if a key exists in storage
   *
   * @param name - Identifier for the key
   */
  async exists(name: string): Promise<boolean> {
    const storageKey = STORAGE_PREFIX + name;
    const result = await chrome.storage.local.get(storageKey);
    return storageKey in result;
  }

  /**
   * Re-encrypts a key with a new password
   *
   * @param name - Identifier for the key
   * @param oldPassword - Current password
   * @param newPassword - New password
   */
  async changePassword(
    name: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    // Decrypt with old password
    const apiKey = await this.retrieve(name, oldPassword);

    // Re-encrypt with new password
    await this.store(name, apiKey, newPassword);
  }
}

/**
 * Creates a singleton KeyVault instance
 */
let vaultInstance: KeyVault | null = null;

export function getKeyVault(): KeyVault {
  if (!vaultInstance) {
    vaultInstance = new KeyVault();
  }
  return vaultInstance;
}

/**
 * Validates that a string looks like an API key
 * (doesn't validate actual key, just format)
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Most API keys are 32+ characters
  if (key.length < 32) return false;

  // Should be alphanumeric with possible dashes/underscores
  return /^[a-zA-Z0-9_-]+$/.test(key);
}
