/**
 * Change Detection Utilities
 *
 * Provides hash generation and comparison for detecting changes
 * between web scraping runs.
 */

import type { ExtractedItem } from '../types';

// --- Types ---

export interface DataFingerprint {
  hash: string;
  itemCount: number;
  timestamp: string;
  sampleKeys: string[];
}

export interface ChangeDetectionResult {
  hasChanged: boolean;
  previousHash?: string;
  currentHash: string;
  changeType: 'new' | 'modified' | 'unchanged';
  addedCount?: number;
  removedCount?: number;
}

// --- Hash Utilities ---

/**
 * Generate SHA-256 hash of a string using Web Crypto API
 * (Available in service workers and modern browsers)
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize an extracted item for consistent hashing
 * - Trims whitespace
 * - Lowercases strings
 * - Sorts keys alphabetically
 * - Handles nested structures recursively
 */
function normalizeForHash(item: ExtractedItem): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(item)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      // Normalize whitespace and case for consistent hashing
      normalized[key] = value.trim().toLowerCase().replace(/\s+/g, ' ');
    } else if (Array.isArray(value)) {
      normalized[key] = value.map(v =>
        typeof v === 'object' && v !== null
          ? normalizeForHash(v as ExtractedItem)
          : v
      );
    } else if (typeof value === 'object') {
      normalized[key] = normalizeForHash(value as ExtractedItem);
    } else {
      normalized[key] = value;
    }
  }

  // Sort keys for consistent ordering
  return Object.fromEntries(
    Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))
  );
}

// --- Public API ---

/**
 * Generate a deterministic fingerprint of extracted data
 *
 * @param data - Array of extracted items
 * @returns DataFingerprint with hash, count, timestamp, and sample keys
 */
export async function generateDataFingerprint(
  data: ExtractedItem[]
): Promise<DataFingerprint> {
  // Normalize and sort data for consistent hashing
  const normalized = data.map(item => normalizeForHash(item));
  normalized.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  const dataString = JSON.stringify(normalized);
  const hash = await hashString(dataString);

  // Extract sample keys for quick comparison
  const sampleKeys = data.length > 0
    ? Object.keys(data[0]).slice(0, 5)
    : [];

  return {
    hash,
    itemCount: data.length,
    timestamp: new Date().toISOString(),
    sampleKeys,
  };
}

/**
 * Compare current data fingerprint with previous fingerprint
 *
 * @param currentFingerprint - Fingerprint of current scrape
 * @param previousFingerprint - Fingerprint of previous scrape (optional)
 * @returns ChangeDetectionResult indicating if and how data changed
 */
export function detectChanges(
  currentFingerprint: DataFingerprint,
  previousFingerprint?: DataFingerprint
): ChangeDetectionResult {
  // No previous data - this is a new scrape
  if (!previousFingerprint) {
    return {
      hasChanged: true,
      currentHash: currentFingerprint.hash,
      changeType: 'new',
    };
  }

  const hasChanged = currentFingerprint.hash !== previousFingerprint.hash;

  return {
    hasChanged,
    previousHash: previousFingerprint.hash,
    currentHash: currentFingerprint.hash,
    changeType: hasChanged ? 'modified' : 'unchanged',
    addedCount: Math.max(0, currentFingerprint.itemCount - previousFingerprint.itemCount),
    removedCount: Math.max(0, previousFingerprint.itemCount - currentFingerprint.itemCount),
  };
}

/**
 * Quick check if data has likely changed based on item count
 * (Useful for early exit before full hash computation)
 *
 * @param currentCount - Number of items in current scrape
 * @param previousFingerprint - Previous fingerprint to compare against
 * @returns true if counts differ (definite change), false if same (needs hash check)
 */
export function hasCountChanged(
  currentCount: number,
  previousFingerprint?: DataFingerprint
): boolean {
  if (!previousFingerprint) return true;
  return currentCount !== previousFingerprint.itemCount;
}

/**
 * Generate a simple hash for a single item (for field-level change tracking)
 *
 * @param item - Single extracted item
 * @returns Hash string for the item
 */
export async function hashItem(item: ExtractedItem): Promise<string> {
  const normalized = normalizeForHash(item);
  return hashString(JSON.stringify(normalized));
}
