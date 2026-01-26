// Re-export recording and tutorial types
export * from './types/recording';
export * from './types/tutorial';

// Pattern Detection Types
export interface PatternMatch {
  tag: string;
  classes: string[];
  id?: string;
  dataAttrs: Record<string, string>;
  ariaAttrs: Record<string, string>;
  parent: Element;
  siblings: Element[];
  confidence: number;
}

export interface PatternDetectorConfig {
  matchBy: ('tag' | 'class' | 'id' | 'data' | 'aria')[];
  minSiblings: number;
  depthLimit: number;
}

// Auto-Scroller Types
export interface ScrollerConfig {
  throttleMs: number;
  maxItems?: number;
  retryCount: number;
  retryDelayMs: number;
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
  | 'CLEAR_DATA'
  | 'UPDATE_CONFIG';

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
