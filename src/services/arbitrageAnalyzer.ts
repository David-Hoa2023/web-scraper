/**
 * Arbitrage Analyzer - Opportunity detection and profit calculation
 * Finds arbitrage opportunities and provides AI-powered analysis
 */

import { getStorageManager, STORAGE_TYPES } from '../core/storageManager';
import { getEventBus } from '../core/eventBus';
import { getPriceComparisonService } from './priceComparison';
import { getTrendDetectionService } from './trendDetection';
import { getLLMGateway } from './llmGateway';
import type {
  ArbitrageOpportunity,
  PriceSnapshot,
  PriceTrend,
  RiskMetrics,
  ArbitrageRecommendation,
  ArbitrageFilters,
  PlatformId,
} from '../types/arbitrage';
import type { ExtractedItem } from '../types';

/**
 * Arbitrage analyzer configuration
 */
export interface ArbitrageAnalyzerConfig {
  minProfitMargin: number; // Minimum margin percentage
  maxVolatility: number; // Maximum acceptable volatility
  enableAIAnalysis: boolean;
  opportunityTTLDays: number; // How long to keep opportunities
}

const DEFAULT_CONFIG: ArbitrageAnalyzerConfig = {
  minProfitMargin: 20, // 20% minimum margin
  maxVolatility: 0.3, // 30% max volatility
  enableAIAnalysis: true,
  opportunityTTLDays: 7,
};

/**
 * Arbitrage Analyzer Service
 */
export class ArbitrageAnalyzer {
  private storage = getStorageManager();
  private eventBus = getEventBus();
  private priceService = getPriceComparisonService();
  private trendService = getTrendDetectionService();
  private config: ArbitrageAnalyzerConfig;

  constructor(config: Partial<ArbitrageAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Find arbitrage opportunities from scraped products
   */
  async findOpportunities(
    products: PriceSnapshot[],
    sourcePlatform: PlatformId,
    targetPlatforms: PlatformId[] = ['temu', 'shein', 'aliexpress', 'shopee', 'lazada', 'tiktokshop'],
    minMargin: number = this.config.minProfitMargin
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Filter target platforms (exclude source)
    const targets = targetPlatforms.filter((p) => p !== sourcePlatform);

    for (const product of products) {
      // Find matches on target platforms
      const matches = await this.priceService.findAllMatches(product, targets);

      for (const match of matches) {
        if (!match.estimatedProfit) continue;

        // Check if meets minimum margin
        if (match.estimatedProfit.profitMarginPercent < minMargin) continue;

        // Get trend data for risk assessment
        const trend = await this.trendService.analyzeTrend(
          product.productId,
          product.platform,
          '30d'
        );

        // Calculate risk metrics
        const riskMetrics = await this.calculateRiskMetrics(
          product,
          match.matchedProducts[0],
          trend
        );

        // Determine recommendation
        const recommendation = this.getRecommendation(
          match.estimatedProfit.profitMarginPercent,
          riskMetrics
        );

        // Create opportunity
        const opportunity: ArbitrageOpportunity = {
          id: `opp_${product.id}_${match.matchedProducts[0].id}`,
          sourceProduct: product,
          targetProduct: match.matchedProducts[0],
          financials: match.estimatedProfit,
          riskMetrics,
          recommendation,
          createdAt: Date.now(),
        };

        // Get AI analysis if enabled
        if (this.config.enableAIAnalysis && recommendation !== 'avoid') {
          try {
            opportunity.aiAnalysis = await this.getAIAnalysis(opportunity);
          } catch {
            // AI analysis is optional, continue without it
          }
        }

        // Store the opportunity
        await this.storeOpportunity(opportunity);
        opportunities.push(opportunity);

        // Emit event
        this.eventBus.emitSync('arbitrage:opportunity:detected' as any, {
          id: opportunity.id,
          margin: match.estimatedProfit.profitMarginPercent,
          recommendation,
        });
      }
    }

    // Sort by profit margin
    return opportunities.sort(
      (a, b) => b.financials.profitMarginPercent - a.financials.profitMarginPercent
    );
  }

  /**
   * Find opportunities from extracted items (raw scrape data)
   */
  async findOpportunitiesFromExtracted(
    items: ExtractedItem[],
    sourcePlatform: PlatformId,
    targetPlatforms?: PlatformId[]
  ): Promise<ArbitrageOpportunity[]> {
    // Convert extracted items to price snapshots
    const snapshots: PriceSnapshot[] = [];

    for (const item of items) {
      const snapshot = this.extractedItemToSnapshot(item, sourcePlatform);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    return this.findOpportunities(snapshots, sourcePlatform, targetPlatforms);
  }

  /**
   * Get stored opportunities with filters
   */
  async getOpportunities(
    filters: ArbitrageFilters = {}
  ): Promise<ArbitrageOpportunity[]> {
    const allData = await chrome.storage.local.get(null);
    let opportunities: ArbitrageOpportunity[] = [];

    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith(STORAGE_TYPES.ARB_OPPORTUNITY)) {
        opportunities.push(value as ArbitrageOpportunity);
      }
    }

    // Apply filters
    if (filters.minMargin !== undefined) {
      opportunities = opportunities.filter(
        (o) => o.financials.profitMarginPercent >= filters.minMargin!
      );
    }

    if (filters.maxRisk !== undefined) {
      opportunities = opportunities.filter(
        (o) => o.riskMetrics.confidence >= 1 - filters.maxRisk!
      );
    }

    if (filters.platforms && filters.platforms.length > 0) {
      opportunities = opportunities.filter(
        (o) =>
          filters.platforms!.includes(o.sourceProduct.platform) ||
          filters.platforms!.includes(o.targetProduct.platform)
      );
    }

    if (filters.recommendation && filters.recommendation.length > 0) {
      opportunities = opportunities.filter((o) =>
        filters.recommendation!.includes(o.recommendation)
      );
    }

    if (!filters.showDismissed) {
      opportunities = opportunities.filter((o) => !o.dismissed);
    }

    // Sort
    const sortBy = filters.sortBy || 'margin';
    const sortOrder = filters.sortOrder || 'desc';
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    opportunities.sort((a, b) => {
      switch (sortBy) {
        case 'margin':
          return (a.financials.profitMarginPercent - b.financials.profitMarginPercent) * multiplier;
        case 'confidence':
          return (a.riskMetrics.confidence - b.riskMetrics.confidence) * multiplier;
        case 'date':
          return (a.createdAt - b.createdAt) * multiplier;
        case 'risk':
          return (a.riskMetrics.priceVolatility - b.riskMetrics.priceVolatility) * multiplier;
        default:
          return 0;
      }
    });

    // Apply pagination
    if (filters.offset || filters.limit) {
      const start = filters.offset || 0;
      const end = filters.limit ? start + filters.limit : undefined;
      opportunities = opportunities.slice(start, end);
    }

    return opportunities;
  }

  /**
   * Dismiss an opportunity
   */
  async dismissOpportunity(opportunityId: string): Promise<void> {
    const key = `${STORAGE_TYPES.ARB_OPPORTUNITY}${opportunityId}`;
    const opportunity = await this.storage.get<ArbitrageOpportunity>(key);

    if (opportunity) {
      opportunity.dismissed = true;
      opportunity.updatedAt = Date.now();
      await this.storage.set(key, opportunity, STORAGE_TYPES.ARB_OPPORTUNITY);

      this.eventBus.emitSync('arbitrage:opportunity:dismissed' as any, {
        id: opportunityId,
      });
    }
  }

  /**
   * Add notes to an opportunity
   */
  async addNotes(opportunityId: string, notes: string): Promise<void> {
    const key = `${STORAGE_TYPES.ARB_OPPORTUNITY}${opportunityId}`;
    const opportunity = await this.storage.get<ArbitrageOpportunity>(key);

    if (opportunity) {
      opportunity.notes = notes;
      opportunity.updatedAt = Date.now();
      await this.storage.set(key, opportunity, STORAGE_TYPES.ARB_OPPORTUNITY);
    }
  }

  /**
   * Get opportunity statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byRecommendation: Record<ArbitrageRecommendation, number>;
    avgMargin: number;
    avgConfidence: number;
    byPlatform: Record<PlatformId, number>;
  }> {
    const opportunities = await this.getOpportunities({ showDismissed: false });

    const byRecommendation: Record<ArbitrageRecommendation, number> = {
      buy: 0,
      hold: 0,
      avoid: 0,
    };

    const byPlatform: Record<PlatformId, number> = {
      temu: 0,
      shein: 0,
      aliexpress: 0,
      shopee: 0,
      lazada: 0,
      tiktokshop: 0,
    };

    let totalMargin = 0;
    let totalConfidence = 0;

    for (const opp of opportunities) {
      byRecommendation[opp.recommendation]++;
      byPlatform[opp.sourceProduct.platform]++;
      totalMargin += opp.financials.profitMarginPercent;
      totalConfidence += opp.riskMetrics.confidence;
    }

    return {
      total: opportunities.length,
      byRecommendation,
      avgMargin: opportunities.length > 0 ? totalMargin / opportunities.length : 0,
      avgConfidence: opportunities.length > 0 ? totalConfidence / opportunities.length : 0,
      byPlatform,
    };
  }

  /**
   * Calculate risk metrics for an opportunity
   */
  private async calculateRiskMetrics(
    source: PriceSnapshot,
    _target: PriceSnapshot,
    trend: PriceTrend | null
  ): Promise<RiskMetrics> {
    // Calculate volatility
    const volatility = trend?.volatility || 0;

    // Get trend direction
    const trendDirection = trend?.trend || 'stable';

    // Estimate competitor count (simplified - based on sales data)
    let competitorCount = 5; // Default medium competition
    if (source.soldCount) {
      if (source.soldCount > 10000) competitorCount = 10; // High competition
      else if (source.soldCount < 1000) competitorCount = 3; // Low competition
    }

    // Estimate demand signal
    let demandSignal: 'high' | 'medium' | 'low' = 'medium';
    if (source.soldCount) {
      if (source.soldCount > 5000) demandSignal = 'high';
      else if (source.soldCount < 500) demandSignal = 'low';
    }

    // Calculate confidence score
    let confidence = 0.7; // Base confidence

    // Adjust based on trend
    if (trend) {
      confidence += trend.trendStrength * 0.1;
      if (trendDirection === 'down') confidence += 0.05; // Lower buy price expected
    }

    // Adjust based on volatility
    if (volatility > this.config.maxVolatility) {
      confidence -= 0.2;
    } else if (volatility < 0.1) {
      confidence += 0.1;
    }

    // Adjust based on demand
    if (demandSignal === 'high') confidence += 0.1;
    else if (demandSignal === 'low') confidence -= 0.1;

    // Clamp confidence to 0-1
    confidence = Math.max(0, Math.min(1, confidence));

    return {
      priceVolatility: volatility,
      trendDirection,
      competitorCount,
      demandSignal,
      confidence,
    };
  }

  /**
   * Get recommendation based on margin and risk
   */
  private getRecommendation(
    margin: number,
    risk: RiskMetrics
  ): ArbitrageRecommendation {
    // Strong buy signal
    if (
      margin >= 30 &&
      risk.confidence >= 0.7 &&
      risk.priceVolatility < this.config.maxVolatility
    ) {
      return 'buy';
    }

    // Avoid signal
    if (
      margin < this.config.minProfitMargin ||
      risk.confidence < 0.4 ||
      risk.priceVolatility > this.config.maxVolatility * 1.5
    ) {
      return 'avoid';
    }

    // Hold/wait signal
    if (risk.trendDirection === 'down' || margin < 25) {
      return 'hold';
    }

    return margin >= 25 && risk.confidence >= 0.5 ? 'buy' : 'hold';
  }

  /**
   * Get AI-powered analysis for an opportunity
   */
  private async getAIAnalysis(
    opportunity: ArbitrageOpportunity
  ): Promise<string> {
    const llm = getLLMGateway();

    const prompt = `Analyze this arbitrage opportunity:

Source Product: ${opportunity.sourceProduct.title}
- Platform: ${opportunity.sourceProduct.platform}
- Price: ${opportunity.sourceProduct.currency} ${opportunity.sourceProduct.price}
- Rating: ${opportunity.sourceProduct.rating || 'N/A'}
- Sales: ${opportunity.sourceProduct.sales || 'N/A'}

Target Product: ${opportunity.targetProduct.title}
- Platform: ${opportunity.targetProduct.platform}
- Price: ${opportunity.targetProduct.currency} ${opportunity.targetProduct.price}

Financials:
- Profit Margin: ${opportunity.financials.profitMarginPercent.toFixed(1)}%
- Estimated Profit per Unit: $${opportunity.financials.profitPerUnit.toFixed(2)}

Risk Assessment:
- Price Volatility: ${(opportunity.riskMetrics.priceVolatility * 100).toFixed(1)}%
- Trend: ${opportunity.riskMetrics.trendDirection}
- Confidence: ${(opportunity.riskMetrics.confidence * 100).toFixed(0)}%

Provide a brief (2-3 sentences) analysis focusing on:
1. Market viability
2. Key risks to watch
3. Action recommendation`;

    const response = await llm.complete(prompt, {
      maxTokens: 200,
      temperature: 0.3,
    });

    return response.content;
  }

  /**
   * Convert extracted item to price snapshot
   */
  private extractedItemToSnapshot(
    item: ExtractedItem,
    platform: PlatformId
  ): PriceSnapshot | null {
    const title = (item.title as string) || (item.name as string);
    const priceStr = (item.price as string) || '';
    const price = parseFloat(priceStr.replace(/[^\d.]/g, ''));

    if (!title || isNaN(price) || price <= 0) {
      return null;
    }

    return {
      id: `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      platform,
      productId: (item.id as string) || (item.productId as string) || String(Date.now()),
      title,
      price,
      currency: 'USD', // Default, should be determined by platform
      url: (item.url as string) || (item.link as string) || window.location.href,
      image: (item.image as string) || (item.img as string),
      timestamp: Date.now(),
      rating: parseFloat(String(item.rating || '0')),
      sales: (item.sales as string) || (item.sold as string),
    };
  }

  /**
   * Store opportunity
   */
  private async storeOpportunity(
    opportunity: ArbitrageOpportunity
  ): Promise<void> {
    const key = `${STORAGE_TYPES.ARB_OPPORTUNITY}${opportunity.id}`;
    await this.storage.set(key, opportunity, STORAGE_TYPES.ARB_OPPORTUNITY);
  }

  /**
   * Cleanup old opportunities
   */
  async cleanupOldOpportunities(): Promise<number> {
    const allData = await chrome.storage.local.get(null);
    const cutoff = Date.now() - this.config.opportunityTTLDays * 24 * 60 * 60 * 1000;
    let removedCount = 0;

    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith(STORAGE_TYPES.ARB_OPPORTUNITY)) {
        const opportunity = value as ArbitrageOpportunity;
        if (opportunity.createdAt < cutoff) {
          await this.storage.remove(key);
          removedCount++;
        }
      }
    }

    return removedCount;
  }
}

// Singleton instance
let arbitrageAnalyzerInstance: ArbitrageAnalyzer | null = null;

/**
 * Get the global arbitrage analyzer instance
 */
export function getArbitrageAnalyzer(): ArbitrageAnalyzer {
  if (!arbitrageAnalyzerInstance) {
    arbitrageAnalyzerInstance = new ArbitrageAnalyzer();
  }
  return arbitrageAnalyzerInstance;
}
