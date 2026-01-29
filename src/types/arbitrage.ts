/**
 * Arbitrage Types - Type definitions for e-commerce arbitrage features
 * Supports 6 platforms: Temu, Shein, AliExpress, Shopee, Lazada, TikTok Shop
 */

// Platform field extraction type (extends base ExtractionType)
export type PlatformFieldType = 'text' | 'href' | 'src' | 'attr' | 'computed';

/**
 * Field definition for extracting data from platform-specific elements
 */
export interface PlatformField {
  name: string;
  selector: string;
  type: PlatformFieldType;
  attrName?: string;
  fallbackSelectors?: string[];
  parser?: 'price' | 'percent' | 'rating' | 'number' | 'sales';
}

/**
 * Platform configuration for e-commerce sites
 */
export interface PlatformConfig {
  name: string;
  id: PlatformId;
  domains: string[];
  itemSelector: string;
  itemSelectorFallbacks?: string[];
  fields: PlatformField[];
  rateLimit: number; // ms between requests
  currency: string;
  currencySymbol?: string;
  logoUrl?: string;
  regionalDomains?: Record<string, string>; // region code -> currency
}

/**
 * Supported platform identifiers
 */
export type PlatformId =
  | 'temu'
  | 'shein'
  | 'aliexpress'
  | 'shopee'
  | 'lazada'
  | 'tiktokshop';

/**
 * Price snapshot for historical tracking
 */
export interface PriceSnapshot {
  id: string; // Auto-generated: `${platform}_${productId}_${timestamp}`
  platform: PlatformId;
  productId: string;
  title: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  currency: string;
  url: string;
  image?: string;
  timestamp: number;
  rating?: number;
  reviewCount?: number;
  sales?: string;
  soldCount?: number;
  shipping?: string;
  shippingCost?: number;
  seller?: string;
  location?: string;
}

/**
 * Profit estimate for arbitrage opportunity
 */
export interface ProfitEstimate {
  buyPrice: number;
  sellPrice: number;
  buyCurrency: string;
  sellCurrency: string;
  profitPerUnit: number;
  profitMarginPercent: number;
  fees?: number;
  shippingCost?: number;
  netProfit?: number;
}

/**
 * Product match across platforms
 */
export interface ProductMatch {
  id: string;
  referenceProduct: PriceSnapshot;
  matchedProducts: PriceSnapshot[];
  matchConfidence: number; // 0-1
  matchMethod: 'title' | 'image' | 'hybrid';
  titleSimilarity?: number;
  imageSimilarity?: number;
  estimatedProfit?: ProfitEstimate;
  createdAt: number;
}

/**
 * Price trend period options
 */
export type TrendPeriod = '7d' | '30d' | '90d';

/**
 * Price trend direction
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Price trend analysis result
 */
export interface PriceTrend {
  productId: string;
  platform: PlatformId;
  period: TrendPeriod;
  startPrice: number;
  endPrice: number;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  stdDev: number;
  volatility: number; // coefficient of variation
  trend: TrendDirection;
  trendStrength: number; // R-squared of regression
  slope: number; // price change per day
  pricePoints: Array<{ timestamp: number; price: number }>;
  anomalies: PriceAnomaly[];
}

/**
 * Price anomaly detection result
 */
export interface PriceAnomaly {
  timestamp: number;
  price: number;
  zScore: number;
  type: 'spike' | 'drop' | 'outlier';
  significance: 'low' | 'medium' | 'high';
}

/**
 * Best buy timing result
 */
export interface BestBuyResult {
  productId: string;
  platform: PlatformId;
  currentPrice: number;
  lowestPrice: number;
  lowestPriceDate: number;
  recommendation: 'buy_now' | 'wait' | 'price_drop_likely' | 'price_rise_likely';
  confidence: number;
  reasoning: string;
}

/**
 * Arbitrage recommendation
 */
export type ArbitrageRecommendation = 'buy' | 'hold' | 'avoid';

/**
 * Risk metrics for arbitrage opportunity
 */
export interface RiskMetrics {
  priceVolatility: number;
  trendDirection: TrendDirection;
  competitorCount: number;
  demandSignal?: 'high' | 'medium' | 'low';
  supplySignal?: 'abundant' | 'moderate' | 'scarce';
  confidence: number; // 0-1
}

/**
 * Arbitrage opportunity
 */
export interface ArbitrageOpportunity {
  id: string;
  sourceProduct: PriceSnapshot;
  targetProduct: PriceSnapshot;
  financials: ProfitEstimate;
  riskMetrics: RiskMetrics;
  recommendation: ArbitrageRecommendation;
  aiAnalysis?: string;
  tags?: string[];
  createdAt: number;
  updatedAt?: number;
  dismissed?: boolean;
  notes?: string;
}

/**
 * Arbitrage filter options
 */
export interface ArbitrageFilters {
  minMargin?: number;
  maxRisk?: number;
  platforms?: PlatformId[];
  recommendation?: ArbitrageRecommendation[];
  sortBy?: 'margin' | 'confidence' | 'date' | 'risk';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  showDismissed?: boolean;
}

/**
 * Arbitrage settings
 */
export interface ArbitrageSettings {
  enabledPlatforms: PlatformId[];
  minProfitMargin: number; // percentage
  maxPriceVolatility: number;
  autoMatch: boolean;
  matchThreshold: number; // title similarity threshold
  alertOnOpportunity: boolean;
  alertMinMargin: number;
  trackPriceHistory: boolean;
  priceHistoryDays: number;
}

/**
 * Default arbitrage settings
 */
export const DEFAULT_ARBITRAGE_SETTINGS: ArbitrageSettings = {
  enabledPlatforms: ['temu', 'shein', 'aliexpress', 'shopee', 'lazada', 'tiktokshop'],
  minProfitMargin: 20,
  maxPriceVolatility: 0.3,
  autoMatch: true,
  matchThreshold: 0.6,
  alertOnOpportunity: true,
  alertMinMargin: 30,
  trackPriceHistory: true,
  priceHistoryDays: 30,
};

/**
 * Storage key prefixes for arbitrage data
 */
export const ARBITRAGE_STORAGE_KEYS = {
  PRICE_SNAPSHOT: 'arb_price_',
  OPPORTUNITY: 'arb_opp_',
  MATCH: 'arb_match_',
  SETTINGS: 'arb_settings',
  TREND_CACHE: 'arb_trend_',
} as const;

/**
 * Arbitrage message types for Chrome messaging
 */
export type ArbitrageMessageType =
  | 'RECORD_PRICE'
  | 'GET_PRICE_HISTORY'
  | 'FIND_MATCHES'
  | 'ANALYZE_ARBITRAGE'
  | 'GET_OPPORTUNITIES'
  | 'DISMISS_OPPORTUNITY'
  | 'GET_TREND'
  | 'GET_BEST_BUY_TIME'
  | 'GET_ARBITRAGE_SETTINGS'
  | 'UPDATE_ARBITRAGE_SETTINGS'
  | 'CLEAR_ARBITRAGE_DATA'
  | 'SCHEDULE_PRICE_MONITOR'
  | 'DETECT_PLATFORM';

/**
 * Arbitrage event types for EventBus
 */
export type ArbitrageEventType =
  | 'arbitrage:price:recorded'
  | 'arbitrage:match:found'
  | 'arbitrage:opportunity:detected'
  | 'arbitrage:opportunity:dismissed'
  | 'arbitrage:trend:updated'
  | 'arbitrage:anomaly:detected'
  | 'arbitrage:platform:detected'
  | 'arbitrage:settings:updated';

/**
 * Platform detection result
 */
export interface PlatformDetectionResult {
  detected: boolean;
  platform: PlatformConfig | null;
  url: string;
  timestamp: number;
}
