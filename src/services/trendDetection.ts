/**
 * Trend Detection Service - Price trend analysis and anomaly detection
 * Uses linear regression for trend direction and Z-score for anomalies
 */

import { getStorageManager, STORAGE_TYPES } from '../core/storageManager';
import { getEventBus } from '../core/eventBus';
import { getPriceComparisonService } from './priceComparison';
import {
  linearRegression,
  linearRegressionLine,
  standardDeviation,
  mean,
  rSquared,
  min,
  max,
} from 'simple-statistics';
import type {
  PriceTrend,
  PriceAnomaly,
  BestBuyResult,
  TrendPeriod,
  TrendDirection,
  PlatformId,
} from '../types/arbitrage';

/**
 * Trend detection configuration
 */
export interface TrendDetectionConfig {
  anomalyZScoreThreshold: number; // Z-score threshold for anomaly
  minDataPoints: number; // Minimum points for trend analysis
  volatilityWindow: number; // Days for volatility calculation
}

const DEFAULT_CONFIG: TrendDetectionConfig = {
  anomalyZScoreThreshold: 2.0, // 2 standard deviations
  minDataPoints: 5,
  volatilityWindow: 7,
};

/**
 * Period to days mapping
 */
const PERIOD_DAYS: Record<TrendPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/**
 * Trend Detection Service
 */
export class TrendDetectionService {
  private storage = getStorageManager();
  private eventBus = getEventBus();
  private priceService = getPriceComparisonService();
  private config: TrendDetectionConfig;

  constructor(config: Partial<TrendDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze price trend for a product
   */
  async analyzeTrend(
    productId: string,
    platform: PlatformId,
    period: TrendPeriod = '30d'
  ): Promise<PriceTrend | null> {
    // Get price history
    const history = await this.priceService.getPriceHistory(productId, [platform]);

    if (history.length < this.config.minDataPoints) {
      return null;
    }

    // Filter to period
    const periodDays = PERIOD_DAYS[period];
    const cutoffTime = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const periodHistory = history.filter((s) => s.timestamp >= cutoffTime);

    if (periodHistory.length < this.config.minDataPoints) {
      return null;
    }

    // Prepare data for analysis
    const pricePoints = periodHistory
      .map((s) => ({ timestamp: s.timestamp, price: s.price }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const prices = pricePoints.map((p) => p.price);
    const timestamps = pricePoints.map((p) => p.timestamp);

    // Calculate statistics
    const avgPrice = mean(prices);
    const stdDev = standardDeviation(prices);
    const minPrice = min(prices);
    const maxPrice = max(prices);
    const volatility = stdDev / avgPrice; // Coefficient of variation

    // Linear regression for trend
    const regressionData = pricePoints.map((p, i) => [i, p.price]);
    const regression = linearRegression(regressionData as [number, number][]);
    const regressionLine = linearRegressionLine(regression);
    const r2 = rSquared(regressionData as [number, number][], regressionLine);

    // Determine trend direction
    const trendStrength = Math.abs(r2);
    let trend: TrendDirection = 'stable';

    if (trendStrength > 0.3) {
      // Significant trend
      trend = regression.m > 0 ? 'up' : 'down';
    }

    // Calculate slope as price change per day
    const totalDays =
      (timestamps[timestamps.length - 1] - timestamps[0]) / (24 * 60 * 60 * 1000);
    const slopePerDay = totalDays > 0 ? regression.m / totalDays : 0;

    // Detect anomalies
    const anomalies = this.detectAnomalies(pricePoints, avgPrice, stdDev);

    const priceTrend: PriceTrend = {
      productId,
      platform,
      period,
      startPrice: prices[0],
      endPrice: prices[prices.length - 1],
      currentPrice: prices[prices.length - 1],
      minPrice,
      maxPrice,
      avgPrice,
      stdDev,
      volatility,
      trend,
      trendStrength,
      slope: slopePerDay,
      pricePoints,
      anomalies,
    };

    // Cache the trend
    const cacheKey = `${STORAGE_TYPES.ARB_TREND}${platform}_${productId}_${period}`;
    await this.storage.set(cacheKey, priceTrend, STORAGE_TYPES.ARB_TREND);

    // Emit event
    this.eventBus.emitSync('arbitrage:trend:updated' as any, {
      productId,
      platform,
      trend,
      trendStrength,
    });

    return priceTrend;
  }

  /**
   * Detect price anomalies using Z-score
   */
  detectAnomalies(
    pricePoints: Array<{ timestamp: number; price: number }>,
    avgPrice?: number,
    stdDev?: number
  ): PriceAnomaly[] {
    const prices = pricePoints.map((p) => p.price);
    const avg = avgPrice ?? mean(prices);
    const std = stdDev ?? standardDeviation(prices);

    if (std === 0) return [];

    const anomalies: PriceAnomaly[] = [];

    for (const point of pricePoints) {
      const zScore = (point.price - avg) / std;
      const absZScore = Math.abs(zScore);

      if (absZScore >= this.config.anomalyZScoreThreshold) {
        const type = zScore > 0 ? 'spike' : 'drop';
        const significance: 'low' | 'medium' | 'high' =
          absZScore >= 3 ? 'high' : absZScore >= 2.5 ? 'medium' : 'low';

        anomalies.push({
          timestamp: point.timestamp,
          price: point.price,
          zScore,
          type,
          significance,
        });
      }
    }

    // Emit anomaly events
    for (const anomaly of anomalies) {
      if (anomaly.significance === 'high') {
        this.eventBus.emitSync('arbitrage:anomaly:detected' as any, {
          ...anomaly,
        });
      }
    }

    return anomalies;
  }

  /**
   * Check if a price is anomalous compared to recent history
   */
  isAnomalousPrice(
    currentPrice: number,
    recentPrices: number[]
  ): { isAnomaly: boolean; zScore: number; type?: 'spike' | 'drop' } {
    if (recentPrices.length < 3) {
      return { isAnomaly: false, zScore: 0 };
    }

    const avg = mean(recentPrices);
    const std = standardDeviation(recentPrices);

    if (std === 0) {
      return { isAnomaly: false, zScore: 0 };
    }

    const zScore = (currentPrice - avg) / std;
    const isAnomaly = Math.abs(zScore) >= this.config.anomalyZScoreThreshold;

    return {
      isAnomaly,
      zScore,
      type: isAnomaly ? (zScore > 0 ? 'spike' : 'drop') : undefined,
    };
  }

  /**
   * Find best time to buy based on historical patterns
   */
  async findBestBuyTime(
    productId: string,
    platform: PlatformId
  ): Promise<BestBuyResult | null> {
    // Get 90-day trend for comprehensive analysis
    const trend = await this.analyzeTrend(productId, platform, '90d');

    if (!trend || trend.pricePoints.length < 10) {
      return null;
    }

    const currentPrice = trend.currentPrice;
    const lowestPrice = trend.minPrice;
    const highestPrice = trend.maxPrice;
    const avgPrice = trend.avgPrice;

    // Calculate price position (0 = lowest, 1 = highest)
    const priceRange = highestPrice - lowestPrice;
    const pricePosition =
      priceRange > 0 ? (currentPrice - lowestPrice) / priceRange : 0.5;

    // Find when lowest price occurred
    const lowestPricePoint = trend.pricePoints.find(
      (p) => p.price === lowestPrice
    );
    const lowestPriceDate = lowestPricePoint?.timestamp || Date.now();

    // Determine recommendation
    let recommendation: BestBuyResult['recommendation'];
    let confidence: number;
    let reasoning: string;

    if (pricePosition <= 0.2) {
      // Price is near historical low
      recommendation = 'buy_now';
      confidence = 0.8;
      reasoning = `Price is near historical low (${Math.round(pricePosition * 100)}% from lowest). Good time to buy.`;
    } else if (pricePosition >= 0.8) {
      // Price is near historical high
      if (trend.trend === 'down') {
        recommendation = 'wait';
        confidence = 0.7;
        reasoning = `Price is near historical high but trending down. Wait for price drop.`;
      } else {
        recommendation = 'wait';
        confidence = 0.6;
        reasoning = `Price is near historical high and not showing downward trend. Wait for better price.`;
      }
    } else if (trend.trend === 'down' && trend.trendStrength > 0.3) {
      recommendation = 'price_drop_likely';
      confidence = trend.trendStrength;
      reasoning = `Price is trending downward (R²=${trend.trendStrength.toFixed(2)}). Consider waiting.`;
    } else if (trend.trend === 'up' && trend.trendStrength > 0.3) {
      recommendation = 'price_rise_likely';
      confidence = trend.trendStrength;
      reasoning = `Price is trending upward (R²=${trend.trendStrength.toFixed(2)}). Consider buying soon.`;
    } else {
      recommendation = currentPrice <= avgPrice ? 'buy_now' : 'wait';
      confidence = 0.5;
      reasoning =
        currentPrice <= avgPrice
          ? `Price is below average (${((1 - currentPrice / avgPrice) * 100).toFixed(1)}% below). Reasonable time to buy.`
          : `Price is above average (${((currentPrice / avgPrice - 1) * 100).toFixed(1)}% above). Consider waiting.`;
    }

    return {
      productId,
      platform,
      currentPrice,
      lowestPrice,
      lowestPriceDate,
      recommendation,
      confidence,
      reasoning,
    };
  }

  /**
   * Get cached trend if available
   */
  async getCachedTrend(
    productId: string,
    platform: PlatformId,
    period: TrendPeriod
  ): Promise<PriceTrend | null> {
    const cacheKey = `${STORAGE_TYPES.ARB_TREND}${platform}_${productId}_${period}`;
    const cached = await this.storage.get<PriceTrend>(cacheKey);

    // Check if cache is still valid (less than 1 hour old)
    if (cached && Date.now() - cached.pricePoints[cached.pricePoints.length - 1]?.timestamp < 3600000) {
      return cached;
    }

    return null;
  }

  /**
   * Calculate price volatility for recent period
   */
  async calculateVolatility(
    productId: string,
    platform: PlatformId
  ): Promise<number | null> {
    const history = await this.priceService.getPriceHistory(productId, [platform]);

    if (history.length < 3) return null;

    // Get prices from volatility window
    const windowMs = this.config.volatilityWindow * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    const recentPrices = history
      .filter((s) => s.timestamp >= cutoff)
      .map((s) => s.price);

    if (recentPrices.length < 3) return null;

    const avg = mean(recentPrices);
    const std = standardDeviation(recentPrices);

    return avg > 0 ? std / avg : 0;
  }

  /**
   * Get price change percentage over period
   */
  async getPriceChange(
    productId: string,
    platform: PlatformId,
    period: TrendPeriod
  ): Promise<{ changePercent: number; startPrice: number; endPrice: number } | null> {
    const trend = await this.analyzeTrend(productId, platform, period);

    if (!trend) return null;

    const changePercent =
      trend.startPrice > 0
        ? ((trend.endPrice - trend.startPrice) / trend.startPrice) * 100
        : 0;

    return {
      changePercent,
      startPrice: trend.startPrice,
      endPrice: trend.endPrice,
    };
  }
}

// Singleton instance
let trendDetectionInstance: TrendDetectionService | null = null;

/**
 * Get the global trend detection service instance
 */
export function getTrendDetectionService(): TrendDetectionService {
  if (!trendDetectionInstance) {
    trendDetectionInstance = new TrendDetectionService();
  }
  return trendDetectionInstance;
}
