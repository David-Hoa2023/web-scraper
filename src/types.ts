// Re-export recording, tutorial, and arbitrage types
export * from './types/recording';
export * from './types/tutorial';
export * from './types/arbitrage';

// Pattern Detection Types
export interface Fingerprint {
  tag: string;
  classes: string[]; // For debugging/fallback, not strict match
  attrs: Record<string, string>; // Stable attributes like data-id prefix
  depth: number; // Depth relative to container
  childCount: number;
}

export interface PatternMatch {
  container: Element;
  fingerprint: Fingerprint;
  siblings: Element[]; // All matches in container
  isSingle: boolean;
  confidence: number;
}

export interface PatternDetectorConfig {
  matchBy: ('tag' | 'class' | 'id' | 'data' | 'aria')[];
  minListItems: number; // Formerly minSiblings
  allowSingleFallback: boolean;
  simThreshold: number; // Jaccard/structure similarity threshold
  depthLimit: number;
}

// Auto-Scroller Types
export interface ScrollerConfig {
  throttleMs: number;
  maxItems?: number;
  retryCount: number;
  retryDelayMs: number;
  // Random delay to avoid detection/bans (in milliseconds)
  randomDelayMin?: number;
  randomDelayMax?: number;
  // Page limit (for multi-page scraping)
  maxPages?: number;
}

export type ScrollerStatus = 'idle' | 'running' | 'paused' | 'error';

export interface ScrollerState {
  status: ScrollerStatus;
  itemsCollected: number;
  errors: string[];
}

export type ScrollProgressCallback = (state: ScrollerState) => void;

// Data Extraction Types
export type ExtractionType = 'text' | 'href' | 'src' | 'attr';

export interface ExtractionField {
  name: string;
  selector: string;
  type: ExtractionType;
  attrName?: string;
}

export interface ExtractionConfig {
  fields: ExtractionField[];
  preserveHierarchy: boolean;
  normalize: boolean;
}

export interface ExtractedItem {
  [key: string]: string | ExtractedItem | ExtractedItem[] | undefined;
}

// Scraping Template Types
export interface ScrapingTemplate {
  id: string;
  name: string;
  description?: string;
  // URL matching
  urlPattern: string;           // Regex pattern for URL matching
  siteHostname: string;         // For quick hostname matching
  // Scraping configuration
  containerSelector: string;    // CSS selector for the repeating container
  extractionConfig: ExtractionConfig;
  patternConfig: PatternDetectorConfig;
  scrollerConfig?: ScrollerConfig;
  // Metadata
  createdAt: string;
  updatedAt?: string;
  lastUsedAt?: string;
  useCount: number;
  // Optional settings
  webhookUrl?: string;
  autoApply?: boolean;          // Auto-apply when visiting matching URL
}

// UI Types
export interface OverlayState {
  visible: boolean;
  position: { x: number; y: number };
  minimized: boolean;
}

export interface ScraperUIState {
  status: ScrollerStatus;
  itemsCollected: number;
  maxItems?: number;
  previewItems: ExtractedItem[];
  errors: string[];
}

// Message Types (for Chrome messaging)
export type MessageType =
  | 'START_SCRAPE'
  | 'PAUSE_SCRAPE'
  | 'RESUME_SCRAPE'
  | 'STOP_SCRAPE'
  | 'GET_STATUS'
  | 'EXPORT_DATA'
  | 'EXPORT_EXCEL'
  | 'EXPORT_CSV'
  | 'EXPORT_JSON'
  | 'ANALYZE_DATA'
  | 'ANALYZE_WITH_LLM'
  | 'CLEAR_DATA'
  | 'UPDATE_CONFIG'
  // Recording messages
  | 'START_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'STOP_RECORDING'
  | 'GET_RECORDING_STATUS'
  // Tutorial messages
  | 'GENERATE_TUTORIAL'
  | 'EXPORT_TUTORIAL'
  | 'PREVIEW_TUTORIAL'
  // Scheduler messages
  | 'SCHEDULE_TASK'
  | 'UNSCHEDULE_TASK'
  | 'RUN_TASK_NOW'
  | 'GET_SCHEDULED_TASKS'
  | 'GET_TASK_HISTORY'
  | 'RESCHEDULE_ALL'
  | 'START_SCRAPE_SELECTION'
  | 'UPDATE_STATUS'
  | 'UPDATE_PROGRESS'
  | 'SHOW_ERROR'
  | 'UPDATE_PREVIEW'
  | 'SET_EXTENSION_ENABLED'
  // Saved URLs messages
  | 'GET_SAVED_URLS'
  | 'ADD_SAVED_URL'
  | 'REMOVE_SAVED_URL'
  | 'UPDATE_SAVED_URL_USAGE'
  | 'SAVED_URLS_UPDATED'
  // Scraping template messages
  | 'GET_TEMPLATES'
  | 'SAVE_TEMPLATE'
  | 'UPDATE_TEMPLATE'
  | 'DELETE_TEMPLATE'
  | 'FIND_MATCHING_TEMPLATE'
  | 'APPLY_TEMPLATE'
  | 'TEMPLATE_APPLIED'
  // Pattern selector messages
  | 'GET_PATTERN_SELECTORS'
  | 'PATTERN_SELECTORS_UPDATED'
  // Arbitrage messages
  | 'DETECT_PLATFORM'
  | 'EXTRACT_PRODUCTS'
  | 'RECORD_PRICE'
  | 'RECORD_PRICES'
  | 'GET_PRICE_HISTORY'
  | 'FIND_MATCHES'
  | 'FIND_ALL_MATCHES'
  | 'GET_TREND'
  | 'GET_BEST_BUY_TIME'
  | 'ANALYZE_ARBITRAGE'
  | 'GET_OPPORTUNITIES'
  | 'DISMISS_OPPORTUNITY'
  | 'GET_ARBITRAGE_STATS'
  | 'GET_ARBITRAGE_SETTINGS'
  | 'UPDATE_ARBITRAGE_SETTINGS'
  | 'CLEANUP_ARBITRAGE'
  // Language learning messages
  | 'CHINESE_LEARN';

export interface ScraperMessage {
  type: MessageType;
  payload?: unknown;
}

export interface ScraperResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Storage Types
export interface StoredConfig {
  patternConfig: PatternDetectorConfig;
  scrollerConfig: ScrollerConfig;
  extractionConfig: ExtractionConfig;
}

export interface StoredData {
  items: ExtractedItem[];
  url: string;
  timestamp: number;
}
