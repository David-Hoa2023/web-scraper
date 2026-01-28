/**
 * Storage Manager - Quota management and auto-pruning
 * ARCH-4: Monitor chrome.storage quota with LRU eviction
 */

import { getEventBus } from './eventBus';

/**
 * Storage item metadata
 */
interface StorageItemMeta {
  key: string;
  size: number;
  createdAt: number;
  lastAccessedAt: number;
  type: string;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  bytesUsed: number;
  bytesTotal: number;
  percentUsed: number;
  itemCount: number;
  byType: Record<string, { count: number; size: number }>;
}

/**
 * Storage manager configuration
 */
export interface StorageManagerConfig {
  warningThreshold: number; // Percentage (0-100)
  criticalThreshold: number; // Percentage (0-100)
  metaKey: string;
  checkIntervalMs: number;
  autoCleanup: boolean;
  cleanupTargetPercent: number; // Target usage after cleanup
}

const DEFAULT_CONFIG: StorageManagerConfig = {
  warningThreshold: 80,
  criticalThreshold: 95,
  metaKey: '_storage_meta',
  checkIntervalMs: 60000,
  autoCleanup: true,
  cleanupTargetPercent: 70,
};

/**
 * Storage type prefixes for categorization
 */
export const STORAGE_TYPES = {
  SCRAPE_DATA: 'scrape_',
  RECORDING: 'recording_',
  TUTORIAL: 'tutorial_',
  ENCRYPTED_KEY: 'encrypted_key_',
  SETTINGS: 'settings_',
  CACHE: 'cache_',
  JOB_QUEUE: 'job_queue',
} as const;

/**
 * Storage Manager for quota monitoring and cleanup
 */
export class StorageManager {
  private meta: Map<string, StorageItemMeta> = new Map();
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: StorageManagerConfig;
  private eventBus = getEventBus();

  constructor(config: Partial<StorageManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize storage manager
   */
  async init(): Promise<void> {
    await this.loadMeta();
    await this.syncMeta();
    this.startMonitoring();
  }

  /**
   * Store data with metadata tracking
   */
  async set<T>(
    key: string,
    value: T,
    type: string = this.inferType(key)
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    const size = new Blob([serialized]).size;

    // Check if this would exceed quota
    const stats = await this.getStats();
    if (stats.bytesUsed + size > stats.bytesTotal * 0.95) {
      if (this.config.autoCleanup) {
        await this.cleanup(size);
      } else {
        this.eventBus.emitSync('storage:quota:exceeded', { key, size });
        throw new Error('Storage quota would be exceeded');
      }
    }

    // Store the data
    await chrome.storage.local.set({ [key]: value });

    // Update metadata
    const existing = this.meta.get(key);
    this.meta.set(key, {
      key,
      size,
      type,
      createdAt: existing?.createdAt || Date.now(),
      lastAccessedAt: Date.now(),
    });

    await this.saveMeta();
  }

  /**
   * Get data and update access time
   */
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    const value = result[key] as T | undefined;

    if (value !== undefined) {
      // Update last accessed time
      const meta = this.meta.get(key);
      if (meta) {
        meta.lastAccessedAt = Date.now();
        await this.saveMeta();
      }
    }

    return value;
  }

  /**
   * Remove data and metadata
   */
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
    this.meta.delete(key);
    await this.saveMeta();
  }

  /**
   * Remove multiple keys
   */
  async removeMany(keys: string[]): Promise<void> {
    await chrome.storage.local.remove(keys);
    for (const key of keys) {
      this.meta.delete(key);
    }
    await this.saveMeta();
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    const bytesUsed = await chrome.storage.local.getBytesInUse(null);
    const bytesTotal = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default

    const byType: Record<string, { count: number; size: number }> = {};
    for (const item of this.meta.values()) {
      if (!byType[item.type]) {
        byType[item.type] = { count: 0, size: 0 };
      }
      byType[item.type].count++;
      byType[item.type].size += item.size;
    }

    return {
      bytesUsed,
      bytesTotal,
      percentUsed: (bytesUsed / bytesTotal) * 100,
      itemCount: this.meta.size,
      byType,
    };
  }

  /**
   * Cleanup old data using LRU eviction
   */
  async cleanup(minBytesToFree?: number): Promise<number> {
    const stats = await this.getStats();
    const targetUsage = (this.config.cleanupTargetPercent / 100) * stats.bytesTotal;
    const bytesToFree = minBytesToFree
      ? Math.max(minBytesToFree, stats.bytesUsed - targetUsage)
      : stats.bytesUsed - targetUsage;

    if (bytesToFree <= 0) return 0;

    // Sort items by last accessed time (oldest first)
    // Exclude settings and encrypted keys from cleanup
    const candidates = Array.from(this.meta.values())
      .filter(
        (m) =>
          m.type !== 'settings' &&
          !m.key.startsWith(STORAGE_TYPES.ENCRYPTED_KEY) &&
          m.key !== this.config.metaKey
      )
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    let freedBytes = 0;
    const keysToRemove: string[] = [];

    for (const item of candidates) {
      if (freedBytes >= bytesToFree) break;
      keysToRemove.push(item.key);
      freedBytes += item.size;
    }

    if (keysToRemove.length > 0) {
      await this.removeMany(keysToRemove);
      this.eventBus.emitSync('storage:cleaned', {
        freedBytes,
        removedCount: keysToRemove.length,
      });
    }

    return freedBytes;
  }

  /**
   * Get items by type
   */
  getItemsByType(type: string): StorageItemMeta[] {
    return Array.from(this.meta.values()).filter((m) => m.type === type);
  }

  /**
   * Get oldest items
   */
  getOldestItems(limit: number): StorageItemMeta[] {
    return Array.from(this.meta.values())
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
      .slice(0, limit);
  }

  /**
   * Get largest items
   */
  getLargestItems(limit: number): StorageItemMeta[] {
    return Array.from(this.meta.values())
      .sort((a, b) => b.size - a.size)
      .slice(0, limit);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  private startMonitoring(): void {
    if (this.checkTimer) return;

    this.checkTimer = setInterval(async () => {
      const stats = await this.getStats();

      if (stats.percentUsed >= this.config.criticalThreshold) {
        this.eventBus.emitSync('storage:quota:exceeded', { stats });
        if (this.config.autoCleanup) {
          await this.cleanup();
        }
      } else if (stats.percentUsed >= this.config.warningThreshold) {
        this.eventBus.emitSync('storage:quota:warning', { stats });
      }
    }, this.config.checkIntervalMs);
  }

  private async loadMeta(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.config.metaKey);
      const data = result[this.config.metaKey] as [string, StorageItemMeta][] | undefined;
      if (data && Array.isArray(data)) {
        this.meta = new Map(data);
      }
    } catch (error) {
      console.error('[StorageManager] Failed to load meta:', error);
    }
  }

  private async saveMeta(): Promise<void> {
    try {
      const data = Array.from(this.meta.entries());
      await chrome.storage.local.set({ [this.config.metaKey]: data });
    } catch (error) {
      console.error('[StorageManager] Failed to save meta:', error);
    }
  }

  private async syncMeta(): Promise<void> {
    // Get all keys from storage and sync with metadata
    const all = await chrome.storage.local.get(null);

    for (const key of Object.keys(all)) {
      if (key === this.config.metaKey) continue;

      if (!this.meta.has(key)) {
        const serialized = JSON.stringify(all[key]);
        const size = new Blob([serialized]).size;
        this.meta.set(key, {
          key,
          size,
          type: this.inferType(key),
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
        });
      }
    }

    // Remove metadata for keys that no longer exist
    for (const key of this.meta.keys()) {
      if (!(key in all)) {
        this.meta.delete(key);
      }
    }

    await this.saveMeta();
  }

  private inferType(key: string): string {
    for (const [type, prefix] of Object.entries(STORAGE_TYPES)) {
      if (key.startsWith(prefix)) {
        return type.toLowerCase();
      }
    }
    return 'unknown';
  }
}

// Singleton instance
let storageManagerInstance: StorageManager | null = null;

/**
 * Get the global storage manager instance
 */
export function getStorageManager(): StorageManager {
  if (!storageManagerInstance) {
    storageManagerInstance = new StorageManager();
  }
  return storageManagerInstance;
}

/**
 * Initialize storage manager (call on service worker startup)
 */
export async function initStorageManager(): Promise<StorageManager> {
  const manager = getStorageManager();
  await manager.init();
  return manager;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
