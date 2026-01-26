/**
 * Capture Orchestrator
 * Coordinates DOM event logging, video capture, cursor tracking, and snapshots
 * Ensures all capture systems are synchronized with consistent timestamps
 */

import type {
  RecordingConfig,
  RecordingState,
  RecordingSession,
  RecordingStateCallback,
  RecordingMetadata,
  DomEvent,
  CursorFrame,
  PageSnapshot,
} from '../../types/recording';

import { DEFAULT_RECORDING_CONFIG, INITIAL_RECORDING_STATE } from '../../types/recording';
import { createDomEventLogger, type DomEventLogger } from './domEventLogger';
import { createCursorTracker, type CursorTracker } from './cursorTracker';
import { createVideoCapture, type VideoCapture } from './videoCapture';
import { createSnapshotSystem, type SnapshotSystem } from './snapshotSystem';

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
  /** Check if paused */
  isPaused(): boolean;
  /** Get current session ID */
  getSessionId(): string | null;
}

/**
 * Create a new capture orchestrator instance
 */
export function createCaptureOrchestrator(): CaptureOrchestrator {
  let config: RecordingConfig = { ...DEFAULT_RECORDING_CONFIG };
  let state: RecordingState = { ...INITIAL_RECORDING_STATE };
  let sessionId: string | null = null;
  let metadata: RecordingMetadata | null = null;

  // Capture subsystems
  let domEventLogger: DomEventLogger | null = null;
  let cursorTracker: CursorTracker | null = null;
  let videoCapture: VideoCapture | null = null;
  let snapshotSystem: SnapshotSystem | null = null;

  // State management
  const stateCallbacks: Set<RecordingStateCallback> = new Set();
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  let stateUpdateInterval: ReturnType<typeof setInterval> | null = null;

  function updateState(updates: Partial<RecordingState>): void {
    state = { ...state, ...updates };
    stateCallbacks.forEach((cb) => cb(state));
  }

  function calculateDuration(): number {
    if (!state.startTime) return 0;
    return Date.now() - state.startTime;
  }

  function collectMetadata(): RecordingMetadata {
    return {
      url: window.location.href,
      title: document.title,
      startedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenSize: {
        width: window.screen.width,
        height: window.screen.height,
      },
      devicePixelRatio: window.devicePixelRatio,
    };
  }

  async function start(userConfig?: Partial<RecordingConfig>): Promise<void> {
    if (state.status === 'recording' || state.status === 'paused') {
      throw new Error('Already recording');
    }

    // Merge config
    config = { ...DEFAULT_RECORDING_CONFIG, ...userConfig };
    sessionId = generateSessionId();
    metadata = collectMetadata();

    // Reset state
    updateState({
      status: 'recording',
      startTime: Date.now(),
      duration: 0,
      eventCount: 0,
      frameCount: 0,
      errors: [],
    });

    try {
      // Initialize capture subsystems
      if (config.captureDomEvents) {
        domEventLogger = createDomEventLogger();
        domEventLogger.onEvent(() => {
          updateState({ eventCount: domEventLogger?.getEvents().length || 0 });
        });
        domEventLogger.start();
      }

      if (config.cursorSmoothing) {
        cursorTracker = createCursorTracker({
          tension: 0.3,
          segments: 10,
          minDistance: 5,
        });
        cursorTracker.onFrame(() => {
          updateState({ frameCount: cursorTracker?.getFrames().length || 0 });
        });
        cursorTracker.start();
      }

      if (config.captureVideo) {
        videoCapture = createVideoCapture();
        await videoCapture.start({ quality: config.videoQuality });
      }

      // Initialize snapshot system
      snapshotSystem = createSnapshotSystem();
      snapshotSystem.start(config.snapshotIntervalMs);

      // Set max duration timer
      if (config.maxDurationMs > 0) {
        maxDurationTimer = setTimeout(() => {
          stop().catch((err) => {
            updateState({
              errors: [...state.errors, `Auto-stop failed: ${err.message}`],
            });
          });
        }, config.maxDurationMs);
      }

      // Start state update interval for duration
      stateUpdateInterval = setInterval(() => {
        if (state.status === 'recording') {
          updateState({ duration: calculateDuration() });
        }
      }, 100);
    } catch (error) {
      // Clean up on error
      cleanup();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateState({
        status: 'error',
        errors: [...state.errors, errorMessage],
      });
      throw error;
    }
  }

  function pause(): void {
    if (state.status !== 'recording') return;

    // Pause all subsystems
    videoCapture?.pause();
    // Note: DOM logger and cursor tracker don't have pause - they keep collecting
    // but we track paused state for timeline adjustment

    updateState({ status: 'paused' });
  }

  function resume(): void {
    if (state.status !== 'paused') return;

    videoCapture?.resume();
    updateState({ status: 'recording' });
  }

  async function stop(): Promise<RecordingSession> {
    if (state.status !== 'recording' && state.status !== 'paused') {
      throw new Error('Not recording');
    }

    updateState({ status: 'processing' });

    // Clear timers
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
    if (stateUpdateInterval) {
      clearInterval(stateUpdateInterval);
      stateUpdateInterval = null;
    }

    // Collect data from all subsystems
    const domEvents: DomEvent[] = domEventLogger?.stop() || [];
    const cursorFrames: CursorFrame[] = cursorTracker?.stop() || [];
    const snapshots: PageSnapshot[] = snapshotSystem?.stop() || [];

    let videoBlob: Blob | undefined;
    if (videoCapture?.isRecording()) {
      try {
        videoBlob = await videoCapture.stop();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Video capture failed';
        updateState({ errors: [...state.errors, errorMessage] });
      }
    }

    // Apply cursor smoothing
    const smoothedCursorFrames = cursorTracker
      ? cursorTracker.getSmoothedPath()
      : cursorFrames;

    // Build session
    const session: RecordingSession = {
      id: sessionId!,
      config,
      state: { ...state, status: 'complete' },
      domEvents,
      cursorFrames: smoothedCursorFrames,
      snapshots,
      videoBlob,
      metadata: {
        ...metadata!,
        endedAt: new Date().toISOString(),
      },
    };

    // Update final state
    updateState({
      status: 'complete',
      duration: calculateDuration(),
      eventCount: domEvents.length,
      frameCount: smoothedCursorFrames.length,
    });

    // Cleanup
    cleanup();

    return session;
  }

  function cleanup(): void {
    domEventLogger = null;
    cursorTracker = null;
    videoCapture = null;
    snapshotSystem = null;

    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
    if (stateUpdateInterval) {
      clearInterval(stateUpdateInterval);
      stateUpdateInterval = null;
    }
  }

  function getState(): RecordingState {
    return { ...state };
  }

  function onStateChange(callback: RecordingStateCallback): () => void {
    stateCallbacks.add(callback);
    return () => stateCallbacks.delete(callback);
  }

  function isRecording(): boolean {
    return state.status === 'recording';
  }

  function isPaused(): boolean {
    return state.status === 'paused';
  }

  function getSessionId(): string | null {
    return sessionId;
  }

  return {
    start,
    pause,
    resume,
    stop,
    getState,
    onStateChange,
    isRecording,
    isPaused,
    getSessionId,
  };
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `rec_${timestamp}_${random}`;
}

/**
 * Estimate memory usage of a recording session
 */
export function estimateSessionMemory(session: RecordingSession): number {
  let bytes = 0;

  // DOM events (rough estimate: ~500 bytes per event)
  bytes += session.domEvents.length * 500;

  // Cursor frames (~50 bytes per frame)
  bytes += session.cursorFrames.length * 50;

  // Snapshots (~1KB per snapshot without screenshot, ~100KB with)
  bytes += session.snapshots.length * 1024;
  session.snapshots.forEach((s) => {
    if (s.screenshotDataUrl) {
      bytes += s.screenshotDataUrl.length;
    }
  });

  // Video blob
  if (session.videoBlob) {
    bytes += session.videoBlob.size;
  }

  return bytes;
}

/**
 * Check if session is within memory budget
 */
export function isWithinMemoryBudget(
  session: RecordingSession,
  maxBytes: number = 200 * 1024 * 1024 // 200MB default
): boolean {
  return estimateSessionMemory(session) < maxBytes;
}
