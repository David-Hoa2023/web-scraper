/**
 * Price Comparison Service - Cross-platform product matching and price tracking
 * Uses title similarity (Jaccard) and image comparison for matching
 */

import { getStorageManager, STORAGE_TYPES } from '../core/storageManager';
import { getEventBus } from '../core/eventBus';
import type {
  PriceSnapshot,
  ProductMatch,
  ProfitEstimate,
  PlatformId,
  ArbitrageSettings,
} from '../types/arbitrage';
import { DEFAULT_ARBITRAGE_SETTINGS } from '../types/arbitrage';

/**
 * Configuration for price comparison
 */
export interface PriceComparisonConfig {
  titleMatchThreshold: number; // Jaccard similarity threshold (0-1)
  imageMatchEnabled: boolean;
  maxHistoryDays: number;
  maxSnapshotsPerProduct: number;
}

const DEFAULT_CONFIG: PriceComparisonConfig = {
  titleMatchThreshold: 0.6,
  imageMatchEnabled: true,
  maxHistoryDays: 30,
  maxSnapshotsPerProduct: 100,
};

/**
 * Price Comparison Service
 */
export class PriceComparisonService {
  private storage = getStorageManager();
  private eventBus = getEventBus();
  private config: PriceComparisonConfig;

  constructor(config: Partial<PriceComparisonConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a new price snapshot
   */
  async recordPrice(snapshot: PriceSnapshot): Promise<void> {
    const key = this.getSnapshotKey(snapshot);

    // Store the snapshot
    await this.storage.set(key, snapshot, STORAGE_TYPES.ARB_PRICE);

    // Emit event
    this.eventBus.emitSync('arbitrage:price:recorded' as any, {
      platform: snapshot.platform,
      productId: snapshot.productId,
      price: snapshot.price,
      currency: snapshot.currency,
    });

    // Cleanup old snapshots if needed
    await this.cleanupOldSnapshots(snapshot.platform, snapshot.productId);
  }

  /**
   * Record multiple price snapshots
   */
  async recordPrices(snapshots: PriceSnapshot[]): Promise<void> {
    for (const snapshot of snapshots) {
      await this.recordPrice(snapshot);
    }
  }

  /**
   * Get price history for a product
   */
  async getPriceHistory(
    productId: string,
    platforms?: PlatformId[]
  ): Promise<PriceSnapshot[]> {
    // Get all arbitrage price keys
    const allData = await chrome.storage.local.get(null);
    const snapshots: PriceSnapshot[] = [];

    for (const [key, value] of Object.entries(allData)) {
      if (!key.startsWith(STORAGE_TYPES.ARB_PRICE)) continue;

      const snapshot = value as PriceSnapshot;

      // Filter by productId (partial match for cross-platform)
      const productIdMatch =
        snapshot.productId === productId ||
        snapshot.id.includes(productId) ||
        this.normalizeProductId(snapshot.productId) === this.normalizeProductId(productId);

      if (!productIdMatch) continue;

      // Filter by platforms if specified
      if (platforms && !platforms.includes(snapshot.platform)) continue;

      snapshots.push(snapshot);
    }

    // Sort by timestamp (newest first)
    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get all price snapshots for a platform
   */
  async getSnapshotsByPlatform(platform: PlatformId): Promise<PriceSnapshot[]> {
    const allData = await chrome.storage.local.get(null);
    const snapshots: PriceSnapshot[] = [];

    for (const [key, value] of Object.entries(allData)) {
      if (!key.startsWith(STORAGE_TYPES.ARB_PRICE)) continue;

      const snapshot = value as PriceSnapshot;
      if (snapshot.platform === platform) {
        snapshots.push(snapshot);
      }
    }

    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get the latest snapshot for a product on a platform
   */
  async getLatestSnapshot(
    productId: string,
    platform: PlatformId
  ): Promise<PriceSnapshot | null> {
    const history = await this.getPriceHistory(productId, [platform]);
    return history.length > 0 ? history[0] : null;
  }

  /**
   * Match a product with products from another platform
   */
  async matchProducts(
    reference: PriceSnapshot,
    targetPlatform: PlatformId
  ): Promise<ProductMatch | null> {
    if (reference.platform === targetPlatform) return null;

    // Get snapshots from target platform
    const targetSnapshots = await this.getSnapshotsByPlatform(targetPlatform);

    // Find best matches
    const matches: Array<{ snapshot: PriceSnapshot; confidence: number }> = [];

    for (const target of targetSnapshots) {
      const titleSimilarity = this.calculateTitleSimilarity(
        reference.title,
        target.title
      );

      if (titleSimilarity >= this.config.titleMatchThreshold) {
        matches.push({
          snapshot: target,
          confidence: titleSimilarity,
        });
      }
    }

    if (matches.length === 0) return null;

    // Sort by confidence and take top matches
    matches.sort((a, b) => b.confidence - a.confidence);
    const bestMatches = matches.slice(0, 5);
    const bestMatch = bestMatches[0];

    // Calculate profit estimate
    const profit = this.calculateProfit(reference, bestMatch.snapshot);

    const match: ProductMatch = {
      id: `match_${reference.id}_${bestMatch.snapshot.id}`,
      referenceProduct: reference,
      matchedProducts: bestMatches.map((m) => m.snapshot),
      matchConfidence: bestMatch.confidence,
      matchMethod: 'title',
      titleSimilarity: bestMatch.confidence,
      estimatedProfit: profit,
      createdAt: Date.now(),
    };

    // Store the match
    await this.storage.set(
      `${STORAGE_TYPES.ARB_MATCH}${match.id}`,
      match,
      STORAGE_TYPES.ARB_MATCH
    );

    // Emit event
    this.eventBus.emitSync('arbitrage:match:found' as any, {
      referenceProduct: reference.productId,
      matchedProduct: bestMatch.snapshot.productId,
      confidence: bestMatch.confidence,
    });

    return match;
  }

  /**
   * Find matches for a product across all platforms
   */
  async findAllMatches(
    reference: PriceSnapshot,
    targetPlatforms?: PlatformId[]
  ): Promise<ProductMatch[]> {
    const platforms: PlatformId[] = targetPlatforms || [
      'temu',
      'shein',
      'aliexpress',
      'shopee',
      'lazada',
      'tiktokshop',
    ];

    const matches: ProductMatch[] = [];

    for (const platform of platforms) {
      if (platform === reference.platform) continue;

      const match = await this.matchProducts(reference, platform);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }

  /**
   * Calculate title similarity using Jaccard index
   */
  calculateTitleSimilarity(title1: string, title2: string): number {
    const words1 = this.tokenize(title1);
    const words2 = this.tokenize(title2);

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate profit estimate between buy and sell prices
   */
  calculateProfit(
    buyProduct: PriceSnapshot,
    sellProduct: PriceSnapshot
  ): ProfitEstimate {
    // Normalize prices to the same currency (simplified - assumes USD base)
    const buyPrice = this.convertToUSD(buyProduct.price, buyProduct.currency);
    const sellPrice = this.convertToUSD(sellProduct.price, sellProduct.currency);

    // Estimate fees (platform + shipping)
    const platformFee = sellPrice * 0.1; // 10% platform fee estimate
    const shippingCost = buyProduct.shippingCost || 0;
    const fees = platformFee + shippingCost;

    const profitPerUnit = sellPrice - buyPrice - fees;
    const profitMarginPercent =
      buyPrice > 0 ? (profitPerUnit / buyPrice) * 100 : 0;
    const netProfit = profitPerUnit;

    return {
      buyPrice,
      sellPrice,
      buyCurrency: buyProduct.currency,
      sellCurrency: sellProduct.currency,
      profitPerUnit,
      profitMarginPercent,
      fees,
      shippingCost,
      netProfit,
    };
  }

  /**
   * Get stored matches
   */
  async getStoredMatches(): Promise<ProductMatch[]> {
    const allData = await chrome.storage.local.get(null);
    const matches: ProductMatch[] = [];

    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith(STORAGE_TYPES.ARB_MATCH)) {
        matches.push(value as ProductMatch);
      }
    }

    return matches.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get arbitrage settings
   */
  async getSettings(): Promise<ArbitrageSettings> {
    const stored = await this.storage.get<ArbitrageSettings>(STORAGE_TYPES.ARB_SETTINGS);
    return stored || { ...DEFAULT_ARBITRAGE_SETTINGS };
  }

  /**
   * Update arbitrage settings
   */
  async updateSettings(settings: Partial<ArbitrageSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await this.storage.set(STORAGE_TYPES.ARB_SETTINGS, updated, 'arb_settings');

    this.eventBus.emitSync('arbitrage:settings:updated' as any, { settings: updated });
  }

  /**
   * Tokenize title for similarity comparison
   */
  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2) // Filter short words
        .filter((word) => !this.isStopWord(word))
    );
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'and',
      'for',
      'with',
      'new',
      'hot',
      'sale',
      'free',
      'shipping',
      'best',
      'quality',
      'high',
      'top',
      'good',
      'fashion',
      'style',
      'women',
      'men',
      'kids',
      'size',
      'color',
      'pcs',
      'set',
      'lot',
    ]);
    return stopWords.has(word);
  }

  /**
   * Convert price to USD (simplified conversion)
   */
  private convertToUSD(price: number, currency: string): number {
    // Simplified exchange rates (should use real-time rates in production)
    const rates: Record<string, number> = {
      USD: 1,
      EUR: 1.1,
      GBP: 1.27,
      CNY: 0.14,
      SGD: 0.75,
      MYR: 0.22,
      THB: 0.029,
      VND: 0.000041,
      IDR: 0.000064,
      PHP: 0.018,
      TWD: 0.031,
      BRL: 0.2,
    };

    const rate = rates[currency] || 1;
    return price * rate;
  }

  /**
   * Normalize product ID for comparison
   */
  private normalizeProductId(id: string): string {
    return id.replace(/[^\d]/g, '').slice(-10);
  }

  /**
   * Generate storage key for snapshot
   */
  private getSnapshotKey(snapshot: PriceSnapshot): string {
    return `${STORAGE_TYPES.ARB_PRICE}${snapshot.platform}_${snapshot.productId}_${snapshot.timestamp}`;
  }

  /**
   * Cleanup old snapshots to save storage
   */
  private async cleanupOldSnapshots(
    platform: PlatformId,
    productId: string
  ): Promise<void> {
    const history = await this.getPriceHistory(productId, [platform]);

    // Keep only the most recent snapshots
    if (history.length > this.config.maxSnapshotsPerProduct) {
      const toRemove = history.slice(this.config.maxSnapshotsPerProduct);

      for (const snapshot of toRemove) {
        const key = this.getSnapshotKey(snapshot);
        await this.storage.remove(key);
      }
    }

    // Remove snapshots older than maxHistoryDays
    const cutoffTime =
      Date.now() - this.config.maxHistoryDays * 24 * 60 * 60 * 1000;
    const allData = await chrome.storage.local.get(null);

    for (const [key, value] of Object.entries(allData)) {
      if (!key.startsWith(STORAGE_TYPES.ARB_PRICE)) continue;

      const snapshot = value as PriceSnapshot;
      if (snapshot.timestamp < cutoffTime) {
        await this.storage.remove(key);
      }
    }
  }
}

// Singleton instance
let priceComparisonInstance: PriceComparisonService | null = null;

/**
 * Get the global price comparison service instance
 */
export function getPriceComparisonService(): PriceComparisonService {
  if (!priceComparisonInstance) {
    priceComparisonInstance = new PriceComparisonService();
  }
  return priceComparisonInstance;
}
