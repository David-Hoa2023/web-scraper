/**
 * Capture Orchestrator
 * Coordinates DOM event logging, video capture, and cursor tracking
 */

import type {
  RecordingConfig,
  RecordingState,
  RecordingSession,
  RecordingStateCallback,
} from '../../types/recording';

export interface CaptureOrchestrator {
  /** Start a new recording session */
  start(config?: Partial<RecordingConfig>): Promise<void>;
  /** Pause the current recording */
  pause(): void;
  /** Resume a paused recording */
  resume(): void;
  /** Stop recording and return the session data */
  stop(): Promise<RecordingSession>;
  /** Get current recording state */
  getState(): RecordingState;
  /** Subscribe to state changes, returns unsubscribe function */
  onStateChange(callback: RecordingStateCallback): () => void;
  /** Check if currently recording */
  isRecording(): boolean;
}

/**
 * Create a new capture orchestrator instance
 */
export function createCaptureOrchestrator(): CaptureOrchestrator {
  // TODO: Implement in Stage 4
  throw new Error('Not implemented - Stage 4');
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
