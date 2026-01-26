/**
 * Recording Types for Hexus Integration
 * Handles DOM event logging, video capture, and cursor tracking
 */

// ============================================================================
// Basic Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

// ============================================================================
// Recording Configuration
// ============================================================================

export type VideoQuality = 'low' | 'medium' | 'high';

export interface RecordingConfig {
  /** Enable screen video capture */
  captureVideo: boolean;
  /** Enable DOM event logging */
  captureDomEvents: boolean;
  /** Enable cursor position tracking and smoothing */
  cursorSmoothing: boolean;
  /** Interval between page snapshots (ms) */
  snapshotIntervalMs: number;
  /** Maximum recording duration (ms) - hard limit for memory */
  maxDurationMs: number;
  /** Video quality preset */
  videoQuality: VideoQuality;
  /** Cursor tracking frame rate (fps) */
  cursorFps: number;
}

export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  captureVideo: true,
  captureDomEvents: true,
  cursorSmoothing: true,
  snapshotIntervalMs: 5000,
  maxDurationMs: 300000, // 5 minutes
  videoQuality: 'medium',
  cursorFps: 60,
};

// ============================================================================
// Recording State
// ============================================================================

export type RecordingStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'complete'
  | 'error';

export interface RecordingState {
  status: RecordingStatus;
  startTime: number | null;
  duration: number;
  eventCount: number;
  frameCount: number;
  errors: string[];
}

export const INITIAL_RECORDING_STATE: RecordingState = {
  status: 'idle',
  startTime: null,
  duration: 0,
  eventCount: 0,
  frameCount: 0,
  errors: [],
};

// ============================================================================
// DOM Event Types
// ============================================================================

export type DomEventType =
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'scroll'
  | 'focus'
  | 'blur'
  | 'hover'
  | 'keypress'
  | 'keydown'
  | 'keyup'
  | 'submit'
  | 'select';

export interface ElementSnapshot {
  /** HTML tag name (lowercase) */
  tagName: string;
  /** Element id attribute */
  id?: string;
  /** Element class list */
  classes: string[];
  /** Visible text content (truncated) */
  textContent?: string;
  /** Unique CSS selector for element */
  selector: string;
  /** Element bounding rectangle */
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Relevant attributes (data-*, aria-*, role, etc.) */
  attributes: Record<string, string>;
  /** Element role for accessibility */
  role?: string;
  /** Placeholder text for inputs */
  placeholder?: string;
  /** Input value (sanitized - no passwords) */
  value?: string;
}

export interface DomEvent {
  /** Event type */
  type: DomEventType;
  /** Timestamp relative to recording start (ms) */
  timestamp: number;
  /** Snapshot of the target element */
  target: ElementSnapshot;
  /** Event-specific data */
  data: DomEventData;
  /** Cursor position at time of event */
  cursorPosition: Point;
}

export type DomEventData =
  | ClickEventData
  | InputEventData
  | ScrollEventData
  | KeyEventData
  | FocusEventData
  | HoverEventData;

export interface ClickEventData {
  type: 'click' | 'dblclick';
  button: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface InputEventData {
  type: 'input' | 'change';
  inputType?: string;
  value: string;
  previousValue?: string;
}

export interface ScrollEventData {
  type: 'scroll';
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
}

export interface KeyEventData {
  type: 'keypress' | 'keydown' | 'keyup';
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface FocusEventData {
  type: 'focus' | 'blur';
  relatedTarget?: ElementSnapshot;
}

export interface HoverEventData {
  type: 'hover';
  enterTime: number;
  duration: number;
}

// ============================================================================
// Cursor Frame Types
// ============================================================================

export interface CursorFrame {
  /** Timestamp relative to recording start (ms) */
  timestamp: number;
  /** Raw cursor position */
  position: Point;
  /** Bezier-smoothed cursor position */
  smoothedPosition: Point;
  /** Whether this frame includes a click */
  isClick: boolean;
  /** Click type if isClick is true */
  clickType?: 'left' | 'right' | 'middle';
}

export interface CursorSmoothingConfig {
  /** Bezier curve tension (0-1, higher = tighter curves) */
  tension: number;
  /** Number of interpolated segments between points */
  segments: number;
  /** Minimum distance between points to smooth (px) */
  minDistance: number;
}

export const DEFAULT_CURSOR_SMOOTHING: CursorSmoothingConfig = {
  tension: 0.3,
  segments: 10,
  minDistance: 5,
};

// ============================================================================
// Page Snapshot Types
// ============================================================================

export interface PageSnapshot {
  /** Timestamp relative to recording start (ms) */
  timestamp: number;
  /** Current scroll position */
  scrollPosition: Point;
  /** Viewport dimensions */
  viewportSize: Dimensions;
  /** Hash of DOM content for change detection */
  domHash: string;
  /** Optional screenshot as data URL */
  screenshotDataUrl?: string;
  /** Page title at snapshot time */
  pageTitle: string;
  /** Current URL (may change with SPA navigation) */
  url: string;
}

// ============================================================================
// Recording Session
// ============================================================================

export interface RecordingMetadata {
  /** Page URL at start of recording */
  url: string;
  /** Page title at start of recording */
  title: string;
  /** ISO timestamp when recording started */
  startedAt: string;
  /** ISO timestamp when recording ended */
  endedAt?: string;
  /** Browser user agent */
  userAgent: string;
  /** Screen resolution */
  screenSize: Dimensions;
  /** Device pixel ratio */
  devicePixelRatio: number;
}

export interface RecordingSession {
  /** Unique session identifier */
  id: string;
  /** Recording configuration used */
  config: RecordingConfig;
  /** Current recording state */
  state: RecordingState;
  /** Captured DOM events */
  domEvents: DomEvent[];
  /** Captured cursor frames */
  cursorFrames: CursorFrame[];
  /** Page snapshots */
  snapshots: PageSnapshot[];
  /** Video blob (if video capture enabled) */
  videoBlob?: Blob;
  /** Session metadata */
  metadata: RecordingMetadata;
}

// ============================================================================
// Recording Control Types
// ============================================================================

export type RecordingCommand =
  | 'START_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'STOP_RECORDING'
  | 'GET_RECORDING_STATUS';

export interface RecordingMessage {
  type: RecordingCommand;
  payload?: RecordingConfig;
}

export interface RecordingResponse {
  success: boolean;
  state?: RecordingState;
  session?: RecordingSession;
  error?: string;
}

// ============================================================================
// Callbacks
// ============================================================================

export type RecordingStateCallback = (state: RecordingState) => void;
export type DomEventCallback = (event: DomEvent) => void;
export type CursorFrameCallback = (frame: CursorFrame) => void;
export type SnapshotCallback = (snapshot: PageSnapshot) => void;
