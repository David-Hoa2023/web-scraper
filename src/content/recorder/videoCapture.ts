/**
 * Video Capture
 * Records screen content using MediaRecorder API
 * Uses chrome.tabCapture for tab recording or getDisplayMedia as fallback
 */

import type { VideoQuality } from '../../types/recording';

export interface VideoCapture {
  /** Start video capture */
  start(config: VideoCaptureConfig): Promise<void>;
  /** Stop capture and return video blob */
  stop(): Promise<Blob>;
  /** Pause video capture */
  pause(): void;
  /** Resume video capture */
  resume(): void;
  /** Check if currently recording */
  isRecording(): boolean;
  /** Get current recording duration (ms) */
  getDuration(): number;
  /** Check if paused */
  isPaused(): boolean;
}

export interface VideoCaptureConfig {
  quality: VideoQuality;
  frameRate?: number;
  audioBitsPerSecond?: number;
  videoBitsPerSecond?: number;
}

/** Quality preset configurations */
export const VIDEO_QUALITY_PRESETS: Record<
  VideoQuality,
  { width: number; height: number; videoBitsPerSecond: number; frameRate: number }
> = {
  low: { width: 1280, height: 720, videoBitsPerSecond: 1000000, frameRate: 24 },
  medium: { width: 1920, height: 1080, videoBitsPerSecond: 2500000, frameRate: 30 },
  high: { width: 1920, height: 1080, videoBitsPerSecond: 5000000, frameRate: 60 },
};

/**
 * Create a new video capture instance
 */
export function createVideoCapture(): VideoCapture {
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let recordedChunks: Blob[] = [];
  let recording = false;
  let paused = false;
  let startTime = 0;
  let pausedDuration = 0;
  let pauseStartTime = 0;

  async function start(config: VideoCaptureConfig): Promise<void> {
    if (recording) {
      throw new Error('Already recording');
    }

    if (!isVideoCaptureSupported()) {
      throw new Error('Video capture is not supported in this browser');
    }

    const preset = VIDEO_QUALITY_PRESETS[config.quality];
    const mimeType = getSupportedMimeType();

    try {
      // Try to get display media (works in content scripts with user permission)
      mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: config.frameRate || preset.frameRate },
        },
        audio: false, // No audio capture for now
      });

      // Create MediaRecorder
      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: config.videoBitsPerSecond || preset.videoBitsPerSecond,
      };

      mediaRecorder = new MediaRecorder(mediaStream, recorderOptions);
      recordedChunks = [];

      // Handle data available
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      // Handle stream end (user stopped sharing)
      mediaStream.getVideoTracks()[0].onended = () => {
        if (recording) {
          // User stopped sharing, trigger stop
          stop().catch(console.error);
        }
      };

      // Start recording with timeslice for chunked data
      mediaRecorder.start(1000); // Get data every second
      recording = true;
      paused = false;
      startTime = Date.now();
      pausedDuration = 0;
    } catch (error) {
      // Clean up on error
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      throw error;
    }
  }

  async function stop(): Promise<Blob> {
    if (!recording || !mediaRecorder) {
      throw new Error('Not recording');
    }

    return new Promise((resolve, reject) => {
      if (!mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      mediaRecorder.onstop = () => {
        // Stop all tracks
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop());
          mediaStream = null;
        }

        // Create final blob
        const mimeType = getSupportedMimeType();
        const blob = new Blob(recordedChunks, { type: mimeType });

        // Reset state
        recording = false;
        paused = false;
        recordedChunks = [];
        mediaRecorder = null;

        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        reject(new Error(`MediaRecorder error: ${event}`));
      };

      // Request final data and stop
      mediaRecorder.stop();
    });
  }

  function pause(): void {
    if (!recording || !mediaRecorder || paused) {
      return;
    }

    if (mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      paused = true;
      pauseStartTime = Date.now();
    }
  }

  function resume(): void {
    if (!recording || !mediaRecorder || !paused) {
      return;
    }

    if (mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      paused = false;
      pausedDuration += Date.now() - pauseStartTime;
    }
  }

  function isRecording(): boolean {
    return recording;
  }

  function isPaused(): boolean {
    return paused;
  }

  function getDuration(): number {
    if (!recording) return 0;

    const now = Date.now();
    let duration = now - startTime - pausedDuration;

    if (paused) {
      duration -= now - pauseStartTime;
    }

    return Math.max(0, duration);
  }

  return {
    start,
    stop,
    pause,
    resume,
    isRecording,
    isPaused,
    getDuration,
  };
}

/**
 * Check if video capture is supported in the current environment
 */
export function isVideoCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Get the best supported video MIME type
 */
export function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'video/webm';
}

/**
 * Get video dimensions from a MediaStream
 */
export function getStreamDimensions(
  stream: MediaStream
): { width: number; height: number } | null {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) return null;

  const settings = videoTrack.getSettings();
  return {
    width: settings.width || 0,
    height: settings.height || 0,
  };
}

/**
 * Check if the current context allows getDisplayMedia
 * (requires secure context and user gesture)
 */
export function canCaptureDisplay(): boolean {
  // Must be in secure context (HTTPS or localhost)
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return false;
  }

  // Check if getDisplayMedia is available
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.mediaDevices === 'undefined' ||
    typeof navigator.mediaDevices.getDisplayMedia !== 'function'
  ) {
    return false;
  }

  return true;
}

/**
 * Estimate file size for a recording duration
 * @param durationMs Duration in milliseconds
 * @param quality Video quality preset
 * @returns Estimated file size in bytes
 */
export function estimateFileSize(
  durationMs: number,
  quality: VideoQuality
): number {
  const preset = VIDEO_QUALITY_PRESETS[quality];
  const durationSeconds = durationMs / 1000;
  // bits per second / 8 = bytes per second
  return Math.round((preset.videoBitsPerSecond / 8) * durationSeconds);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
  }
  return `${minutes}:${pad(seconds % 60)}`;
}
