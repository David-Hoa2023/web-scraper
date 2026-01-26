/**
 * Cursor Tracker
 * Tracks mouse position and applies Bezier curve smoothing
 */

import type {
  Point,
  CursorFrame,
  CursorSmoothingConfig,
  CursorFrameCallback,
} from '../../types/recording';

import { DEFAULT_CURSOR_SMOOTHING } from '../../types/recording';

export interface CursorTracker {
  /** Start tracking cursor position */
  start(): void;
  /** Stop tracking and return all frames */
  stop(): CursorFrame[];
  /** Get all frames captured so far */
  getFrames(): CursorFrame[];
  /** Get smoothed path from captured frames */
  getSmoothedPath(): CursorFrame[];
  /** Clear all captured frames */
  clear(): void;
  /** Subscribe to new frames */
  onFrame(callback: CursorFrameCallback): () => void;
  /** Check if currently tracking */
  isTracking(): boolean;
}

/**
 * Create a new cursor tracker instance
 */
export function createCursorTracker(
  config?: Partial<CursorSmoothingConfig>
): CursorTracker {
  const smoothingConfig: CursorSmoothingConfig = {
    ...DEFAULT_CURSOR_SMOOTHING,
    ...config,
  };

  let frames: CursorFrame[] = [];
  const callbacks: Set<CursorFrameCallback> = new Set();
  let isRunning = false;
  let startTime = 0;
  let animationFrameId: number | null = null;
  let lastPosition: Point = { x: 0, y: 0 };
  let lastFrameTime = 0;

  // Frame rate control (default 60fps from config)
  const frameInterval = 1000 / 60;

  function getTimestamp(): number {
    return Date.now() - startTime;
  }

  function emitFrame(frame: CursorFrame): void {
    frames.push(frame);
    callbacks.forEach((cb) => cb(frame));
  }

  function handleMouseMove(e: MouseEvent): void {
    lastPosition = { x: e.clientX, y: e.clientY };
  }

  function handleClick(e: MouseEvent): void {
    if (!isRunning) return;

    const now = getTimestamp();
    const frame: CursorFrame = {
      timestamp: now,
      position: { x: e.clientX, y: e.clientY },
      smoothedPosition: { x: e.clientX, y: e.clientY },
      isClick: true,
      clickType: e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right',
    };
    emitFrame(frame);
  }

  function captureFrame(): void {
    if (!isRunning) return;

    const now = getTimestamp();

    // Rate limit to ~60fps
    if (now - lastFrameTime < frameInterval) {
      animationFrameId = requestAnimationFrame(captureFrame);
      return;
    }

    // Skip if position hasn't changed enough
    if (frames.length > 0) {
      const lastFrame = frames[frames.length - 1];
      const dist = distance(lastPosition, lastFrame.position);
      if (dist < smoothingConfig.minDistance) {
        animationFrameId = requestAnimationFrame(captureFrame);
        return;
      }
    }

    const frame: CursorFrame = {
      timestamp: now,
      position: { ...lastPosition },
      smoothedPosition: { ...lastPosition }, // Will be computed during smoothing
      isClick: false,
    };

    emitFrame(frame);
    lastFrameTime = now;
    animationFrameId = requestAnimationFrame(captureFrame);
  }

  function start(): void {
    if (isRunning) return;

    isRunning = true;
    startTime = Date.now();
    frames = [];
    lastFrameTime = 0;

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('click', handleClick, true);
    document.addEventListener('contextmenu', handleClick, true);
    document.addEventListener('auxclick', handleClick, true);

    // Start frame capture loop
    animationFrameId = requestAnimationFrame(captureFrame);
  }

  function stop(): CursorFrame[] {
    if (!isRunning) return frames;

    isRunning = false;

    // Cancel animation frame
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('contextmenu', handleClick, true);
    document.removeEventListener('auxclick', handleClick, true);

    return frames;
  }

  function getFrames(): CursorFrame[] {
    return [...frames];
  }

  function getSmoothedPath(): CursorFrame[] {
    if (frames.length < 4) return frames;

    // Extract positions
    const positions = frames.map((f) => f.position);
    const smoothedPositions = smoothCursorPath(positions, smoothingConfig);

    // Map smoothed positions back to frames
    return frames.map((frame, i) => ({
      ...frame,
      smoothedPosition: smoothedPositions[i] || frame.position,
    }));
  }

  function clear(): void {
    frames = [];
  }

  function onFrame(callback: CursorFrameCallback): () => void {
    callbacks.add(callback);
    return () => callbacks.delete(callback);
  }

  function isTracking(): boolean {
    return isRunning;
  }

  return {
    start,
    stop,
    getFrames,
    getSmoothedPath,
    clear,
    onFrame,
    isTracking,
  };
}

/**
 * Apply Bezier curve smoothing to a series of points
 * Uses Catmull-Rom spline for natural-looking curves
 */
export function smoothCursorPath(
  points: Point[],
  options?: Partial<CursorSmoothingConfig>
): Point[] {
  if (points.length < 4) return points;

  const config: CursorSmoothingConfig = {
    ...DEFAULT_CURSOR_SMOOTHING,
    ...options,
  };

  const result: Point[] = [];

  // First point stays the same
  result.push(points[0]);

  // Process each segment
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Skip if distance is too small
    const segmentDist = distance(p1, p2);
    if (segmentDist < config.minDistance) {
      continue;
    }

    // Convert Catmull-Rom to Bezier control points
    const { cp1, cp2 } = catmullRomToBezier(p0, p1, p2, p3, config.tension);

    // Generate interpolated points along the curve
    for (let j = 1; j <= config.segments; j++) {
      const t = j / config.segments;
      const point = cubicBezier(t, p1, cp1, cp2, p2);
      result.push(point);
    }
  }

  return result;
}

/**
 * Calculate a point on a cubic Bezier curve
 * @param t - Parameter (0-1)
 * @param p0 - Start point
 * @param p1 - Control point 1
 * @param p2 - Control point 2
 * @param p3 - End point
 */
export function cubicBezier(
  t: number,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point
): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Convert Catmull-Rom control points to Bezier control points
 */
export function catmullRomToBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  tension: number
): { cp1: Point; cp2: Point } {
  // Compute tangent vectors scaled by tension
  const t1x = (p2.x - p0.x) * tension;
  const t1y = (p2.y - p0.y) * tension;
  const t2x = (p3.x - p1.x) * tension;
  const t2y = (p3.y - p1.y) * tension;

  // Convert to Bezier control points
  const cp1: Point = {
    x: p1.x + t1x / 3,
    y: p1.y + t1y / 3,
  };

  const cp2: Point = {
    x: p2.x - t2x / 3,
    y: p2.y - t2y / 3,
  };

  return { cp1, cp2 };
}

/**
 * Calculate the distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Linear interpolation between two points
 */
export function lerp(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

/**
 * Calculate total path length
 */
export function pathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

/**
 * Resample path to have evenly spaced points
 */
export function resamplePath(points: Point[], targetCount: number): Point[] {
  if (points.length < 2 || targetCount < 2) return points;

  const totalLength = pathLength(points);
  const segmentLength = totalLength / (targetCount - 1);

  const result: Point[] = [points[0]];
  let currentLength = 0;
  let nextTargetLength = segmentLength;
  let i = 1;

  while (result.length < targetCount && i < points.length) {
    const dist = distance(points[i - 1], points[i]);

    while (currentLength + dist >= nextTargetLength && result.length < targetCount) {
      const overshoot = nextTargetLength - currentLength;
      const t = overshoot / dist;
      result.push(lerp(points[i - 1], points[i], t));
      nextTargetLength += segmentLength;
    }

    currentLength += dist;
    i++;
  }

  // Ensure we have the last point
  if (result.length < targetCount) {
    result.push(points[points.length - 1]);
  }

  return result;
}
