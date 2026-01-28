// Re-export recording and tutorial types
export * from './types/recording';
export * from './types/tutorial';

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
  | 'EXPORT_EXCEL'
  | 'EXPORT_CSV'
  | 'ANALYZE_DATA'
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
  | 'UPDATE_PREVIEW';

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
